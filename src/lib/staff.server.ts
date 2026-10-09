// Server-only staff helpers. Every staff function resolves the caller's hotel
// and roles from the database first; nothing about the hotel comes from the client.
import { randomBytes } from "crypto";
import { getAdmin, sha256 } from "./guest.server";

export type Role = "owner" | "manager" | "reception" | "housekeeping" | "restaurant" | "spa";
export type StaffCtx = { userId: string; hotelId: string; roles: Role[]; name: string };

/** Which request modules each role may see and update. null = all. */
export const ROLE_MODULES: Record<Role, string[] | null> = {
  owner: null, manager: null, reception: null,
  housekeeping: ["housekeeping", "laundry", "minibar", "maintenance", "room_service"],
  spa: ["spa"],
  restaurant: [],
};
export const ORDER_ROLES: Role[] = ["owner", "manager", "reception", "restaurant"];
export const OPS_ROLES: Role[] = ["owner", "manager", "reception"];
export const MGMT_ROLES: Role[] = ["owner", "manager"];

export async function requireStaff(userId: string, allowed?: Role[]): Promise<StaffCtx> {
  const admin = await getAdmin();
  const { data: m } = await admin.from("staff_members").select("hotel_id, display_name, active").eq("user_id", userId).maybeSingle();
  if (!m || !m.active) throw new Error("Not a staff account");
  const { data: r } = await admin.from("user_roles").select("role").eq("user_id", userId).eq("hotel_id", m.hotel_id);
  const roles = (r ?? []).map((x) => x.role as Role);
  if (allowed && !roles.some((x) => allowed.includes(x))) throw new Error("You don't have access to this");
  return { userId, hotelId: m.hotel_id, roles, name: m.display_name };
}

/** Modules visible to this staff member; null means every module. */
export function visibleModules(ctx: StaffCtx): string[] | null {
  let out: string[] = [];
  for (const r of ctx.roles) {
    const mods = ROLE_MODULES[r];
    if (mods === null) return null;
    out = out.concat(mods);
  }
  return [...new Set(out)];
}

export const randomToken = (bytes = 18) => randomBytes(bytes).toString("base64url");
export const randomCode = () => String(100000 + (randomBytes(4).readUInt32BE(0) % 900000));
export { sha256, getAdmin };

export async function audit(ctx: StaffCtx, action: string, details: Record<string, unknown>) {
  const admin = await getAdmin();
  await admin.from("audit_logs").insert({ hotel_id: ctx.hotelId, actor_user_id: ctx.userId, action, details: details as any });
}
