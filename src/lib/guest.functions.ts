import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  createRequestCore, getAdmin, placeOrderCore, requireStay, resolveStay, sha256,
} from "./guest.server";

const HOTEL_PUBLIC = "id, slug, name, tagline, currency, tax_rate, modules, info";

/** Public: hotel branding + info for the landing page. */
export const getPublicHotel = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => z.object({ slug: z.string().max(60) }).parse(d))
  .handler(async ({ data }) => {
    const admin = await getAdmin();
    const { data: hotel } = await admin.from("hotels").select(HOTEL_PUBLIC).eq("slug", data.slug).maybeSingle();
    if (!hotel) return null;
    const info = { ...(hotel.info as any) };
    delete info.wifi; // wifi only for checked-in guests
    return { ...hotel, info };
  });

/** Public: room QR entry. Reveals hotel info and room number only, never guest data. */
export const resolveRoomQr = createServerFn({ method: "GET" })
  .inputValidator((d: { token: string }) => z.object({ token: z.string().min(4).max(100) }).parse(d))
  .handler(async ({ data }) => {
    const admin = await getAdmin();
    const { data: qr } = await admin.from("room_qr_codes").select("hotel_id, room_id, revoked")
      .eq("token_hash", sha256(data.token)).maybeSingle();
    if (!qr || qr.revoked) return null;
    const [{ data: hotel }, { data: room }] = await Promise.all([
      admin.from("hotels").select(HOTEL_PUBLIC).eq("id", qr.hotel_id).single(),
      admin.from("rooms").select("number, room_type").eq("id", qr.room_id).single(),
    ]);
    const info = { ...(hotel?.info as any) };
    delete info.wifi;
    return { hotel: { ...hotel!, info }, room };
  });

/**
 * The only way in: verify against hotel records (personal invite link, or room
 * number + stay code). On success the server creates a private guest account
 * bound to that active stay and returns a session. No public sign-up exists.
 */
export const verifyStay = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.union([
    z.object({ method: z.literal("invite"), token: z.string().min(4).max(100), name: z.string().trim().max(60).optional() }),
    z.object({ method: z.literal("code"), room: z.string().trim().min(1).max(10), code: z.string().trim().min(4).max(12), name: z.string().trim().max(60).optional() }),
  ]).parse(d))
  .handler(async ({ data }) => {
    const admin = await getAdmin();
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    const ip = getRequestHeader("cf-connecting-ip") ?? getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const clientKey = sha256(`ip:${ip}`);
    const since = new Date(Date.now() - 3600_000).toISOString();
    const { count } = await admin.from("verification_attempts").select("id", { count: "exact", head: true })
      .eq("client_key", clientKey).eq("success", false).gte("created_at", since);
    if ((count ?? 0) >= 5) return { ok: false as const, error: "Too many attempts. Please try again in an hour or contact reception." };

    let stay: { id: string; hotel_id: string; room_number: string } | null = null;
    let inviteId: string | null = null;
    let inviteUses = 0;
    if (data.method === "invite") {
      const { data: inv } = await admin.from("guest_invites").select("*").eq("token_hash", sha256(data.token)).maybeSingle();
      if (inv && !inv.revoked && new Date(inv.expires_at) > new Date() && inv.uses < inv.max_uses) {
        const { data: s } = await admin.from("stays").select("id, hotel_id, status, check_out, rooms(number)").eq("id", inv.stay_id).single();
        if (s && s.status === "active" && new Date(s.check_out) > new Date()) {
          stay = { id: s.id, hotel_id: s.hotel_id, room_number: (s.rooms as any)?.number ?? "" };
          inviteId = inv.id; inviteUses = inv.uses;
        }
      }
    } else {
      const { data: rows } = await admin.from("stays").select("id, hotel_id, check_out, rooms!inner(number)")
        .eq("code", data.code).eq("status", "active").eq("rooms.number", data.room).gt("check_out", new Date().toISOString());
      const s = rows?.[0];
      if (s) stay = { id: s.id, hotel_id: s.hotel_id, room_number: (s.rooms as any)?.number ?? data.room };
    }
    await admin.from("verification_attempts").insert({ client_key: clientKey, kind: data.method, success: !!stay });
    if (!stay) {
      return { ok: false as const, error: data.method === "invite"
        ? "This guest link is invalid or has expired. Please ask reception for a new one."
        : "We couldn't find an active stay with that room number and stay code." };
    }

    const displayName = data.name || `Room ${stay.room_number} Guest`;
    const email = `guest-${crypto.randomUUID()}@guests.stay.invalid`;
    const password = `${crypto.randomUUID()}${crypto.randomUUID()}`;
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { full_name: displayName, stay_id: stay.id },
    });
    if (cErr || !created.user) return { ok: false as const, error: "Couldn't start your session. Please try again." };
    await admin.from("stay_guests").insert({ stay_id: stay.id, hotel_id: stay.hotel_id, user_id: created.user.id, display_name: displayName });
    if (inviteId) await admin.from("guest_invites").update({ uses: inviteUses + 1 }).eq("id", inviteId);
    await admin.from("audit_logs").insert({ hotel_id: stay.hotel_id, actor_user_id: created.user.id, action: "guest.verified", details: { method: data.method, stay_id: stay.id } });

    const { createClient } = await import("@supabase/supabase-js");
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"]!;
    const pub = createClient(process.env["SUPABASE_URL"]!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      } },
    });
    const { data: signed, error: sErr } = await pub.auth.signInWithPassword({ email, password });
    if (sErr || !signed.session) return { ok: false as const, error: "Couldn't start your session. Please try again." };
    return { ok: true as const, accessToken: signed.session.access_token, refreshToken: signed.session.refresh_token };
  });

/** The guest's current stay (or null). Reads via RLS as the user. */
export const getMyStay = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = await resolveStay(context.userId);
    if (!ctx) return null;
    const sb = context.supabase;
    const [{ data: stay }, { data: hotel }, { data: guests }] = await Promise.all([
      sb.from("stays").select("id, code, primary_guest_name, check_in, check_out, rooms(number, room_type)").eq("id", ctx.stayId).single(),
      sb.from("hotels").select(HOTEL_PUBLIC).eq("id", ctx.hotelId).single(),
      sb.from("stay_guests").select("id, display_name, is_primary").eq("stay_id", ctx.stayId),
    ]);
    return { stay, hotel, guests: guests ?? [], me: ctx.guestId };
  });

export const getMenu = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = await requireStay(context.userId);
    const [{ data: categories }, { data: items }] = await Promise.all([
      context.supabase.from("menu_categories").select("id, name, sort").eq("hotel_id", ctx.hotelId).order("sort"),
      context.supabase.from("menu_items").select("*").eq("hotel_id", ctx.hotelId).order("sort"),
    ]);
    return { categories: categories ?? [], items: items ?? [], taxRate: ctx.taxRate };
  });

export const getCatalog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { module: string }) => z.object({ module: z.string().max(30) }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = await requireStay(context.userId);
    const { data: items } = await context.supabase.from("catalog_items").select("*")
      .eq("hotel_id", ctx.hotelId).eq("module", data.module).eq("available", true).order("sort");
    return items ?? [];
  });

export const placeOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    items: z.array(z.object({ menuItemId: z.string().uuid(), qty: z.number().int().min(1).max(20), options: z.array(z.string().max(60)).max(10).optional() })).min(1).max(30),
    destinationRoom: z.string().max(10).optional(),
    notes: z.string().max(500).optional(),
    idempotencyKey: z.string().min(8).max(80),
    source: z.enum(["browse", "concierge"]).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = await requireStay(context.userId);
    return placeOrderCore(ctx, data);
  });

export const createServiceRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    module: z.string().max(30),
    catalogItemId: z.string().uuid().nullable().optional(),
    title: z.string().max(120).optional(),
    details: z.string().max(500).optional(),
    scheduledFor: z.string().datetime({ offset: true }).nullable().optional(),
    quantity: z.number().int().min(1).max(10).optional(),
    source: z.enum(["app", "concierge"]).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = await requireStay(context.userId);
    return createRequestCore(ctx, data);
  });

export const getActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = await requireStay(context.userId);
    const [{ data: orders }, { data: requests }] = await Promise.all([
      context.supabase.from("orders").select("id, status, status_history, total, created_at, notes, order_items(name, qty), rooms:destination_room_id(number)")
        .eq("stay_id", ctx.stayId).order("created_at", { ascending: false }).limit(30),
      context.supabase.from("service_requests").select("id, module, title, status, status_history, amount, scheduled_for, created_at")
        .eq("stay_id", ctx.stayId).order("created_at", { ascending: false }).limit(30),
    ]);
    return { orders: orders ?? [], requests: requests ?? [] };
  });

export const getFolio = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = await requireStay(context.userId);
    const { data } = await context.supabase.from("folio_charges").select("id, category, description, amount, created_at, stay_guests:charged_by_guest_id(display_name)")
      .eq("stay_id", ctx.stayId).order("created_at");
    return data ?? [];
  });

export const getItinerary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = await requireStay(context.userId);
    const { data } = await context.supabase.from("itinerary_items").select("*").eq("stay_id", ctx.stayId).order("starts_at");
    return data ?? [];
  });

export const addPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    title: z.string().min(1).max(120), location: z.string().max(120).optional(),
    startsAt: z.string().datetime({ offset: true }), durationMinutes: z.number().int().min(15).max(720),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = await requireStay(context.userId);
    const admin = await getAdmin();
    const start = new Date(data.startsAt);
    await admin.from("itinerary_items").insert({
      stay_id: ctx.stayId, guest_id: ctx.guestId, title: data.title, location: data.location ?? null, category: "plan",
      starts_at: start.toISOString(), ends_at: new Date(start.getTime() + data.durationMinutes * 60000).toISOString(),
    });
    return { ok: true };
  });

export const getConciergeThread = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = await requireStay(context.userId);
    const admin = await getAdmin();
    const { data } = await admin.from("concierge_threads").select("messages").eq("guest_id", ctx.guestId).maybeSingle();
    return (data?.messages as any[]) ?? [];
  });
