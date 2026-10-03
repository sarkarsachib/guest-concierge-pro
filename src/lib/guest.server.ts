// Server-only business logic shared by server functions and the AI concierge.
// All prices are read from the database here; the client never sends amounts.
import { createHash } from "crypto";

type Admin = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];

export async function getAdmin(): Promise<Admin> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export type StayContext = {
  stayId: string;
  hotelId: string;
  guestId: string;
  roomId: string;
  roomNumber: string;
  roomChargeEnabled: boolean;
  taxRate: number;
};

export async function resolveStay(userId: string): Promise<StayContext | null> {
  const admin = await getAdmin();
  const { data: guests } = await admin
    .from("stay_guests")
    .select("id, stay_id, hotel_id, created_at, stays!inner(id, status, room_id, room_charge_enabled, rooms(number))")
    .eq("user_id", userId)
    .eq("stays.status", "active")
    .order("created_at", { ascending: false })
    .limit(1);
  const g = guests?.[0] as any;
  if (!g) return null;
  const { data: hotel } = await admin.from("hotels").select("tax_rate").eq("id", g.hotel_id).single();
  return {
    stayId: g.stay_id,
    hotelId: g.hotel_id,
    guestId: g.id,
    roomId: g.stays.room_id,
    roomNumber: g.stays.rooms?.number ?? "",
    roomChargeEnabled: g.stays.room_charge_enabled,
    taxRate: Number(hotel?.tax_rate ?? 0),
  };
}

export async function requireStay(userId: string) {
  const s = await resolveStay(userId);
  if (!s) throw new Error("No active stay linked to this account");
  return s;
}

export type OrderLineInput = { menuItemId: string; qty: number; options?: string[] | undefined };

export async function placeOrderCore(
  ctx: StayContext,
  input: { items: OrderLineInput[]; destinationRoom?: string | undefined; notes?: string | undefined; idempotencyKey: string; source?: string | undefined },
) {
  const admin = await getAdmin();
  if (!ctx.roomChargeEnabled) throw new Error("Room charging is disabled for this stay. Please contact reception.");
  const { data: existing } = await admin
    .from("orders").select("id, total").eq("idempotency_key", input.idempotencyKey).eq("stay_id", ctx.stayId).maybeSingle();
  if (existing) return existing;

  let destinationRoomId = ctx.roomId;
  let destNumber = ctx.roomNumber;
  if (input.destinationRoom && input.destinationRoom !== ctx.roomNumber) {
    const { data: room } = await admin.from("rooms").select("id, number")
      .eq("hotel_id", ctx.hotelId).eq("number", input.destinationRoom.trim()).maybeSingle();
    if (!room) throw new Error(`Room ${input.destinationRoom} doesn't exist`);
    destinationRoomId = room.id;
    destNumber = room.number;
  }

  const ids = [...new Set(input.items.map((i) => i.menuItemId))];
  const { data: menu } = await admin.from("menu_items").select("id, name, price, options, available")
    .in("id", ids).eq("hotel_id", ctx.hotelId);
  const byId = new Map((menu ?? []).map((m) => [m.id, m]));
  const lines = input.items.map((li) => {
    const m = byId.get(li.menuItemId);
    if (!m || !m.available) throw new Error("An item in your cart is no longer available");
    const qty = Math.max(1, Math.min(20, Math.floor(li.qty)));
    const groups = (m.options as any[]) ?? [];
    const chosen = (li.options ?? []).flatMap((name) => {
      for (const g of groups) {
        const c = g.choices?.find((c: any) => c.name === name);
        if (c) return [{ group: g.group, name: c.name, price: Number(c.price) }];
      }
      return [];
    });
    const unit = Number(m.price) + chosen.reduce((s, c) => s + c.price, 0);
    return { menu_item_id: m.id, name: m.name, qty, unit_price: unit, options: chosen, line_total: unit * qty };
  });
  if (!lines.length) throw new Error("Cart is empty");
  const subtotal = lines.reduce((s, l) => s + l.line_total, 0);
  const tax = Math.round(subtotal * ctx.taxRate);
  const total = subtotal + tax;
  const now = new Date().toISOString();

  const { data: order, error } = await admin.from("orders").insert({
    hotel_id: ctx.hotelId, stay_id: ctx.stayId, payer_guest_id: ctx.guestId,
    destination_room_id: destinationRoomId, subtotal, tax, total, notes: input.notes?.slice(0, 500) ?? null,
    source: input.source ?? "browse", idempotency_key: input.idempotencyKey,
    status_history: [{ status: "received", at: now }],
  }).select("id, total").single();
  if (error) throw new Error(error.message);
  await admin.from("order_items").insert(lines.map((l) => ({ ...l, order_id: order.id })));
  await admin.from("folio_charges").insert({
    hotel_id: ctx.hotelId, stay_id: ctx.stayId, category: "Dining",
    description: `Room service · ${lines.map((l) => `${l.qty}× ${l.name}`).join(", ")}${destNumber !== ctx.roomNumber ? ` (to room ${destNumber})` : ""}`,
    amount: total, source_type: "order", source_id: order.id, charged_by_guest_id: ctx.guestId,
  });
  return order;
}

export async function createRequestCore(
  ctx: StayContext,
  input: { module: string; catalogItemId?: string | null | undefined; title?: string | undefined; details?: string | undefined; scheduledFor?: string | null | undefined; quantity?: number | undefined; source?: string | undefined },
) {
  const admin = await getAdmin();
  let title = input.title?.slice(0, 120) ?? "Request";
  let amount = 0;
  let duration = 60;
  if (input.catalogItemId) {
    const { data: item } = await admin.from("catalog_items").select("*")
      .eq("id", input.catalogItemId).eq("hotel_id", ctx.hotelId).maybeSingle();
    if (!item || !item.available) throw new Error("That service isn't available");
    title = item.name;
    const qty = Math.max(1, Math.min(10, Math.floor(input.quantity ?? 1)));
    amount = Number(item.price) * qty;
    if (qty > 1) title = `${qty}× ${item.name}`;
    duration = item.duration_minutes ?? 60;
    input.module = item.module;
  }
  if (amount > 0 && !ctx.roomChargeEnabled) throw new Error("Room charging is disabled for this stay");
  const now = new Date().toISOString();
  const { data: req, error } = await admin.from("service_requests").insert({
    hotel_id: ctx.hotelId, stay_id: ctx.stayId, guest_id: ctx.guestId, destination_room_id: ctx.roomId,
    module: input.module, title, details: input.details?.slice(0, 500) ?? null,
    catalog_item_id: input.catalogItemId ?? null, scheduled_for: input.scheduledFor ?? null,
    amount, source: input.source ?? "app", status_history: [{ status: "received", at: now }],
  }).select("id, title, amount, module, scheduled_for").single();
  if (error) throw new Error(error.message);
  if (amount > 0) {
    const tax = Math.round(amount * ctx.taxRate);
    await admin.from("folio_charges").insert({
      hotel_id: ctx.hotelId, stay_id: ctx.stayId, category: input.module.charAt(0).toUpperCase() + input.module.slice(1),
      description: title, amount: amount + tax, source_type: "request", source_id: req.id, charged_by_guest_id: ctx.guestId,
    });
  }
  if (input.scheduledFor) {
    const start = new Date(input.scheduledFor);
    await admin.from("itinerary_items").insert({
      stay_id: ctx.stayId, guest_id: ctx.guestId, title, category: input.module,
      starts_at: start.toISOString(), ends_at: new Date(start.getTime() + duration * 60000).toISOString(),
      source_type: "request", source_id: req.id,
    });
  }
  return req;
}

export async function escalateCore(ctx: StayContext, reason: string, transcript: unknown[]) {
  const admin = await getAdmin();
  const { data } = await admin.from("escalations").insert({
    hotel_id: ctx.hotelId, stay_id: ctx.stayId, guest_id: ctx.guestId, reason: reason.slice(0, 500), transcript: transcript as any,
  }).select("id").single();
  return data;
}
