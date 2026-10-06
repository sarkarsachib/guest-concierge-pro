import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getActivity, getItinerary } from "@/lib/guest.functions";
import { STATUS_STEPS, money, statusLabel } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/stay/trips")({ component: MyStay });

function MyStay() {
  const qc = useQueryClient();
  const { data: act } = useQuery({ queryKey: ["activity"], queryFn: () => getActivity() });
  const { data: plan = [] } = useQuery({ queryKey: ["itinerary"], queryFn: () => getItinerary() });

  useEffect(() => {
    const ch = supabase.channel("my-activity")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => qc.invalidateQueries({ queryKey: ["activity"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "service_requests" }, () => qc.invalidateQueries({ queryKey: ["activity"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "itinerary_items" }, () => qc.invalidateQueries({ queryKey: ["itinerary"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const tracked = [
    ...(act?.orders ?? []).map((o: any) => ({ id: o.id, kind: "Food", title: o.order_items?.map((i: any) => `${i.qty}× ${i.name}`).join(", "), status: o.status, at: o.created_at, amount: o.total, room: o.rooms?.number })),
    ...(act?.requests ?? []).map((r: any) => ({ id: r.id, kind: r.module, title: r.title, status: r.status, at: r.created_at, amount: r.amount, room: undefined as string | undefined })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  const days = new Map<string, any[]>();
  for (const p of plan as any[]) {
    const d = new Date(p.starts_at).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" });
    days.set(d, [...(days.get(d) ?? []), p]);
  }
  const conflicts = new Set<string>();
  const sorted = [...(plan as any[])].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  for (let i = 1; i < sorted.length; i++) if (sorted[i].starts_at < sorted[i - 1].ends_at) { conflicts.add(sorted[i].id); conflicts.add(sorted[i - 1].id); }

  return (
    <main className="space-y-6 px-4 pt-6">
      <h1 className="text-3xl font-bold">My stay</h1>
      <section>
        <h2 className="mb-3 text-lg font-semibold">Live tracking</h2>
        {!tracked.length && <p className="clay p-5 text-sm text-muted-foreground">Nothing in progress. Orders and requests will appear here.</p>}
        <div className="space-y-3">
          {tracked.map((t) => {
            const idx = Math.max(0, STATUS_STEPS.indexOf(t.status as any));
            return (
              <div key={t.id} className="clay p-4">
                <div className="flex justify-between text-xs uppercase tracking-wide text-muted-foreground"><span>{t.kind}{t.room ? ` · to room ${t.room}` : ""}</span>{Number(t.amount) > 0 && <span>{money(t.amount)}</span>}</div>
                <div className="mt-1 font-semibold">{t.title}</div>
                {t.status === "cancelled" ? <p className="mt-2 text-sm text-destructive">Cancelled</p> : (
                  <>
                    <div className="mt-3 flex gap-1">{STATUS_STEPS.map((s, i) => <div key={s} className={`h-2 flex-1 rounded-full ${i <= idx ? "bg-success" : "bg-muted"}`} />)}</div>
                    <p className="mt-2 text-sm font-semibold text-success">{statusLabel[t.status] ?? t.status}</p>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </section>
      <section>
        <h2 className="mb-3 text-lg font-semibold">Itinerary</h2>
        {!days.size && <p className="clay p-5 text-sm text-muted-foreground">No plans yet. Ask the concierge to plan your day.</p>}
        {[...days].map(([d, items]) => (
          <div key={d} className="mb-4">
            <div className="mb-2 text-sm font-semibold text-muted-foreground">{d}</div>
            <div className="clay divide-y divide-border">
              {items.map((p) => (
                <div key={p.id} className="flex gap-3 p-4">
                  <div className="w-14 text-sm font-semibold text-primary">{new Date(p.starts_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</div>
                  <div className="flex-1"><div className="font-semibold">{p.title}</div>{p.location && <div className="text-xs text-muted-foreground">{p.location}</div>}
                    {conflicts.has(p.id) && <div className="mt-1 text-xs font-semibold text-destructive">Overlaps with another plan — ask the concierge to reshuffle</div>}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
