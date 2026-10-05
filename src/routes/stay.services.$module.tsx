import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createServiceRequest, getCatalog } from "@/lib/guest.functions";
import { moduleMeta, money } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export const Route = createFileRoute("/stay/services/$module")({ component: ServicePage });

function ServicePage() {
  const { module } = Route.useParams();
  const meta = moduleMeta[module] ?? { label: module, emoji: "concierge", blurb: "" };
  const qc = useQueryClient();
  const { data: items = [], isLoading } = useQuery({ queryKey: ["catalog", module], queryFn: () => getCatalog({ data: { module } }) });
  const [picked, setPicked] = useState<any>(null);
  const [when, setWhen] = useState("");
  const [details, setDetails] = useState("");
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      await createServiceRequest({ data: {
        module, catalogItemId: picked?.id ?? null, title: picked?.name ?? `${meta.label} request`,
        details: details || undefined, quantity: qty,
        scheduledFor: when ? new Date(when).toISOString() : null,
      } });
      toast.success(Number(picked?.price) > 0 ? "Booked — charged to your room" : "Request sent");
      qc.invalidateQueries({ queryKey: ["activity"] });
      setPicked(null); setDetails(""); setWhen(""); setQty(1);
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }

  return (
    <main className="space-y-4 px-4 pt-6">
      <Link to="/stay" className="text-sm text-muted-foreground">← Home</Link>
      <header className="flex items-center gap-3">
        <img src={`/emoji/${meta.emoji}.png`} alt="" className="h-14 w-14" />
        <div><h1 className="text-3xl font-bold">{meta.label}</h1><p className="text-sm text-muted-foreground">{meta.blurb}</p></div>
      </header>
      <Link to="/stay/concierge" search={{ q: `I need help with ${meta.label.toLowerCase()}` }} className="clay block p-4 text-sm">
        Prefer to just say it? <span className="font-semibold text-primary">Ask the concierge →</span>
      </Link>
      {isLoading && <p className="text-muted-foreground">Loading…</p>}
      <div className="space-y-3">
        {items.map((i: any) => (
          <button key={i.id} disabled={!i.available} onClick={() => setPicked(i)} className="clay flex w-full items-center justify-between p-4 text-left disabled:opacity-50">
            <div><div className="font-semibold">{i.name}</div><div className="text-xs text-muted-foreground">{i.description}{i.duration_minutes ? ` · ${i.duration_minutes} min` : ""}</div></div>
            <span className="ml-3 whitespace-nowrap font-semibold text-primary">{Number(i.price) > 0 ? money(i.price) : "Free"}</span>
          </button>
        ))}
        <button onClick={() => setPicked({ id: null, name: `${meta.label} request`, price: 0 })} className="clay w-full p-4 text-left font-semibold">Something else…</button>
      </div>

      <Sheet open={!!picked} onOpenChange={(o) => !o && setPicked(null)}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader><SheetTitle>{picked?.name}</SheetTitle></SheetHeader>
          <div className="space-y-3 px-4 pb-6">
            {Number(picked?.price) > 0 && (
              <div className="flex items-center gap-3"><span className="text-sm">Quantity</span>
                <Button size="icon-sm" variant="outline" onClick={() => setQty(Math.max(1, qty - 1))}>−</Button><span>{qty}</span>
                <Button size="icon-sm" variant="outline" onClick={() => setQty(Math.min(10, qty + 1))}>+</Button></div>
            )}
            {(picked?.duration_minutes || ["spa", "taxi", "experiences", "celebrations"].includes(module)) && (
              <label className="block text-sm">When?<Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="mt-1" /></label>
            )}
            <Textarea placeholder="Anything we should know?" value={details} onChange={(e) => setDetails(e.target.value)} />
            <Button disabled={busy} size="lg" className="w-full rounded-full" onClick={submit}>
              {Number(picked?.price) > 0 ? `Confirm · ${money(Number(picked.price) * qty)} + taxes to room` : "Send request"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </main>
  );
}
