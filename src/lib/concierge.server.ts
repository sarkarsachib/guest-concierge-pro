import { createOpenAI } from "@ai-sdk/openai";
import { convertToModelMessages, stepCountIs, streamText, tool, type UIMessage } from "ai";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  createLovableAiGatewayRunIdFetch, getLovableAiGatewayRunId, withLovableAiGatewayRunIdHeader,
} from "./ai/run-id.server";
import { createRequestCore, escalateCore, getAdmin, resolveStay } from "./guest.server";

const MODEL = "openai/gpt-6-astra";

async function authUser(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer /, "");
  if (!token || token.split(".").length !== 3) return null;
  const sb = createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_PUBLISHABLE_KEY"]!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data } = await sb.auth.getClaims(token);
  return data?.claims?.sub ?? null;
}

export async function handleConcierge(request: Request) {
  const userId = await authUser(request);
  if (!userId) return new Response("Unauthorized", { status: 401 });
  const ctx = await resolveStay(userId);
  if (!ctx) return new Response("No active stay", { status: 403 });
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return new Response("AI is not configured", { status: 500 });

  const body = (await request.json()) as { messages: UIMessage[] };
  const messages = (body.messages ?? []).slice(-40);
  const admin = await getAdmin();

  const [{ data: hotel }, { data: menu }, { data: catalog }, { data: stay }] = await Promise.all([
    admin.from("hotels").select("name, currency, tax_rate, info, ai_rules, approval_threshold").eq("id", ctx.hotelId).single(),
    admin.from("menu_items").select("id, name, price, is_veg, description, options, available").eq("hotel_id", ctx.hotelId),
    admin.from("catalog_items").select("id, module, name, price, duration_minutes, description").eq("hotel_id", ctx.hotelId).eq("available", true),
    admin.from("stays").select("primary_guest_name, check_in, check_out").eq("id", ctx.stayId).single(),
  ]);

  const system = `You are the AI concierge of ${hotel?.name}. Guest is in room ${ctx.roomNumber} (stay of ${stay?.primary_guest_name}, ${stay?.check_in?.slice(0, 10)} to ${stay?.check_out?.slice(0, 10)}).
Current time: ${new Date().toISOString()} (hotel timezone Asia/Kolkata, UTC+5:30). Currency ${hotel?.currency}. Tax ${Number(hotel?.tax_rate) * 100}% added to charges.
Be warm, brief (1-3 sentences), and act — don't just chat.
Rules:
- Free requests (towels, pillows, cleaning, toiletries, minibar restock, maintenance issues) — call create_request immediately.
- Anything that costs money (food orders, spa, taxi, experiences, celebrations, paid laundry) — NEVER book directly. Call propose_order (food) or propose_booking (paid services). The guest confirms with a button. Then say "Tap confirm to place it."
- Use exact ids from the lists below. Ask a short question if something required (e.g. spice level, time) is missing.
- If the guest is upset, has an emergency, or asks for a human, call escalate_to_human and give the reception phone.
- Never invent menu items, prices, or facilities.
Hotel rules: ${hotel?.ai_rules || "none"}
Hotel info: ${JSON.stringify(hotel?.info)}
MENU: ${JSON.stringify((menu ?? []).filter((m) => m.available))}
SERVICES: ${JSON.stringify(catalog)}`;

  const tools = {
    create_request: tool({
      description: "Create a FREE service request (housekeeping, minibar, maintenance) for the guest's room.",
      inputSchema: z.object({
        catalogItemId: z.string().nullable().describe("Catalog id if matching, else null"),
        module: z.enum(["housekeeping", "maintenance", "minibar", "laundry", "concierge"]),
        title: z.string(),
        details: z.string().nullable(),
      }),
      execute: async (input) => {
        if (input.catalogItemId) {
          const item = (catalog ?? []).find((c) => c.id === input.catalogItemId);
          if (!item || Number(item.price) > 0) return { error: "That item is paid; use propose_booking." };
        }
        const r = await createRequestCore(ctx, {
          module: input.module, catalogItemId: input.catalogItemId, title: input.title,
          details: input.details ?? undefined, source: "concierge",
        });
        return { ok: true, requestId: r.id, title: r.title };
      },
    }),
    propose_order: tool({
      description: "Propose a room-service food/drink order. Guest must confirm before it is placed.",
      inputSchema: z.object({
        items: z.array(z.object({ menuItemId: z.string(), qty: z.number().int(), options: z.array(z.string()) })),
        destinationRoom: z.string().nullable().describe("Only if guest asks to send to another room"),
        notes: z.string().nullable(),
      }),
      execute: async (input) => {
        const lines = input.items.flatMap((li) => {
          const m = (menu ?? []).find((x) => x.id === li.menuItemId);
          if (!m) return [];
          const extra = ((m.options as any[]) ?? []).flatMap((g) => g.choices ?? [])
            .filter((c: any) => li.options.includes(c.name)).reduce((s: number, c: any) => s + Number(c.price), 0);
          return [{ ...li, name: m.name, unit: Number(m.price) + extra }];
        });
        const subtotal = lines.reduce((s, l) => s + l.unit * l.qty, 0);
        const tax = Math.round(subtotal * Number(hotel?.tax_rate ?? 0));
        return { kind: "order", lines, subtotal, tax, total: subtotal + tax, destinationRoom: input.destinationRoom, notes: input.notes };
      },
    }),
    propose_booking: tool({
      description: "Propose a PAID service booking (spa, taxi, experience, celebration, laundry). Guest must confirm.",
      inputSchema: z.object({
        catalogItemId: z.string(),
        quantity: z.number().int(),
        scheduledFor: z.string().nullable().describe("ISO 8601 with +05:30 offset, or null"),
        details: z.string().nullable(),
      }),
      execute: async (input) => {
        const item = (catalog ?? []).find((c) => c.id === input.catalogItemId);
        if (!item) return { error: "Unknown service" };
        const subtotal = Number(item.price) * input.quantity;
        const tax = Math.round(subtotal * Number(hotel?.tax_rate ?? 0));
        return { kind: "booking", ...input, module: item.module, name: item.name, subtotal, tax, total: subtotal + tax };
      },
    }),
    escalate_to_human: tool({
      description: "Hand the conversation to reception staff.",
      inputSchema: z.object({ reason: z.string() }),
      execute: async ({ reason }) => {
        await escalateCore(ctx, reason, messages.slice(-10));
        return { ok: true, message: "Reception has been notified and will reach out shortly." };
      },
    }),
  };

  const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });

  const result = streamText({
    model: provider.responses(MODEL),
    system,
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: stepCountIs(5),
    abortSignal: request.signal,
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
  });

  return withLovableAiGatewayRunIdHeader(
    result.toUIMessageStreamResponse({
      originalMessages: messages,
      sendReasoning: true,
      onFinish: async ({ messages: all }) => {
        await admin.from("concierge_threads").upsert(
          { guest_id: ctx.guestId, messages: all.slice(-60) as any, updated_at: new Date().toISOString() },
          { onConflict: "guest_id" },
        );
      },
    }),
    runIdFetch,
  );
}
