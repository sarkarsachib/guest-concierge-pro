import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getFolio } from "@/lib/guest.functions";
import { money } from "@/lib/format";

export const Route = createFileRoute("/stay/folio")({ component: Folio });

function Folio() {
  const { data = [] } = useQuery({ queryKey: ["folio"], queryFn: () => getFolio() });
  const total = (data as any[]).reduce((s, c) => s + Number(c.amount), 0);
  return (
    <main className="space-y-4 px-4 pt-6">
      <h1 className="text-3xl font-bold">Folio</h1>
      <div className="clay bg-primary p-6 text-primary-foreground">
        <div className="text-sm opacity-80">Current balance</div>
        <div className="font-display text-4xl font-bold">{money(total)}</div>
        <div className="mt-2 text-xs leading-relaxed opacity-80">Settled at check-out. Everything charged to your room appears here.</div>
      </div>
      <div className="clay divide-y divide-border">
        {(data as any[]).map((c) => (
          <div key={c.id} className="flex justify-between gap-3 p-4">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">{c.category} · {new Date(c.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</div>
              <div className="text-sm font-semibold">{c.description}</div>
              {c.stay_guests?.display_name && <div className="text-xs text-muted-foreground">by {c.stay_guests.display_name}</div>}
            </div>
            <div className="whitespace-nowrap font-semibold">{money(c.amount)}</div>
          </div>
        ))}
      </div>
    </main>
  );
}
