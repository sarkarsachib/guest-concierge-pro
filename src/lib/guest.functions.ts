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

export const claimInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { token: string }) => z.object({ token: z.string().min(4).max(100) }).parse(d))
  .handler(async ({ data, context }) => {
    const admin = await getAdmin();
    const { data: inv } = await admin.from("guest_invites").select("*").eq("token_hash", sha256(data.token)).maybeSingle();
    if (!inv || inv.revoked || new Date(inv.expires_at) < new Date() || inv.uses >= inv.max_uses) {
      return { ok: false as const, error: "This guest link is invalid or has expired. Please ask reception for a new one." };
    }
    const { data: stay } = await admin.from("stays").select("id, hotel_id, status").eq("id", inv.stay_id).single();
    if (!stay || stay.status !== "active") return { ok: false as const, error: "This stay is no longer active." };
    const name = (context.claims as any).user_metadata?.full_name ?? (context.claims as any).email ?? "Guest";
    const { data: existing } = await admin.from("stay_guests").select("id").eq("stay_id", stay.id).eq("user_id", context.userId).maybeSingle();
    if (!existing) {
      await admin.from("stay_guests").insert({ stay_id: stay.id, hotel_id: stay.hotel_id, user_id: context.userId, display_name: name });
      await admin.from("guest_invites").update({ uses: inv.uses + 1 }).eq("id", inv.id);
    }
    return { ok: true as const };
  });

export const joinWithCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { room: string; code: string }) =>
    z.object({ room: z.string().min(1).max(10), code: z.string().min(4).max(12) }).parse(d))
  .handler(async ({ data, context }) => {
    const admin = await getAdmin();
    const since = new Date(Date.now() - 3600_000).toISOString();
    const { count } = await admin.from("verification_attempts").select("id", { count: "exact", head: true })
      .eq("user_id", context.userId).eq("success", false).gte("created_at", since);
    if ((count ?? 0) >= 5) return { ok: false as const, error: "Too many attempts. Please try again in an hour or contact reception." };
    const { data: stays } = await admin.from("stays").select("id, hotel_id, rooms!inner(number)")
      .eq("code", data.code.trim()).eq("status", "active").eq("rooms.number", data.room.trim());
    const stay = stays?.[0];
    await admin.from("verification_attempts").insert({ user_id: context.userId, kind: "stay_code", success: !!stay });
    if (!stay) return { ok: false as const, error: "Room number and stay code don't match. Check your key card sleeve." };
    const name = (context.claims as any).user_metadata?.full_name ?? (context.claims as any).email ?? "Guest";
    await admin.from("stay_guests").upsert(
      { stay_id: stay.id, hotel_id: stay.hotel_id, user_id: context.userId, display_name: name },
      { onConflict: "stay_id,user_id", ignoreDuplicates: true },
    );
    return { ok: true as const };
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
