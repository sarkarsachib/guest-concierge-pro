import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getMenu, placeOrder } from "@/lib/guest.functions";
import { menuImages, money } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export const Route = createFileRoute("/stay/dine")({ component: Dine });

type Group = { group: string; required?: boolean; multi?: boolean; choices: { name: string; price: number }[] };
type CartLine = { key: string; menuItemId: string; name: string; qty: number; options: string[]; unit: number };

function Dine() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["menu"], queryFn: () => getMenu() });
  const [cat, setCat] = useState<string | null>(null);
  const [picked, setPicked] = useState<any>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [text, setText] = useState("");

  const items = useMemo(() => (data?.items ?? []).filter((i: any) => !cat || i.category_id === cat), [data, cat]);
  const count = cart.reduce((s, l) => s + l.qty, 0);
  const subtotal = cart.reduce((s, l) => s + l.unit * l.qty, 0);

  function add(item: any, options: string[]) {
    const groups = (item.options ?? []) as Group[];
    const extra = groups.flatMap((g) => g.choices).filter((c) => options.includes(c.name)).reduce((s, c) => s + Number(c.price), 0);
    const key = item.id + "|" + [...options].sort().join(",");
    setCart((c) => {
      const ex = c.find((l) => l.key === key);
      if (ex) return c.map((l) => (l.key === key ? { ...l, qty: l.qty + 1 } : l));
      return [...c, { key, menuItemId: item.id, name: item.name, qty: 1, options, unit: Number(item.price) + extra }];
    });
    toast.success(`${item.name} added`);
  }

  return (
    <main className="space-y-4 px-4 pt-6">
      <h1 className="text-3xl font-bold">In-room dining</h1>
      <form className="clay flex gap-2 p-3" onSubmit={(e) => { e.preventDefault(); if (text.trim()) nav({ to: "/stay/concierge", search: { q: text } }); }}>
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder='"2 butter chicken, 1 biryani, 3 Coke" or "surprise me under ₹800"' className="border-0 shadow-none" />
        <Button className="rounded-full">Ask</Button>
      </form>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <Chip active={!cat} onClick={() => setCat(null)}>All</Chip>
        {data?.categories.map((c: any) => <Chip key={c.id} active={cat === c.id} onClick={() => setCat(c.id)}>{c.name}</Chip>)}
      </div>
      <div className="space-y-3">
        {items.map((i: any) => (
          <button key={i.id} disabled={!i.available} onClick={() => ((i.options ?? []).length ? setPicked(i) : add(i, []))}
            className="clay flex w-full items-center gap-3 p-3 text-left disabled:opacity-50">
            {i.image_key && menuImages[i.image_key]
              ? <img src={menuImages[i.image_key]} alt={i.name} className="h-20 w-20 rounded-2xl object-cover" />
              : <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-secondary"><img src="/emoji/restaurant.png" alt="" className="h-10 w-10" /></div>}
            <div className="flex-1">
              <div className="font-semibold">{i.is_veg ? "🟢" : "🔴"} {i.name}</div>
              <div className="line-clamp-2 text-xs text-muted-foreground">{i.description}</div>
              <div className="mt-1 font-semibold text-primary">{money(i.price)}</div>
            </div>
            <span className="rounded-full bg-accent px-3 py-1 text-sm font-bold text-accent-foreground">{i.available ? "Add" : "Sold out"}</span>
          </button>
        ))}
      </div>

      {count > 0 && (
        <Button size="lg" onClick={() => setCartOpen(true)} className="fixed inset-x-4 bottom-28 z-30 mx-auto max-w-sm rounded-full shadow-xl">
          View cart · {count} · {money(subtotal)}
        </Button>
      )}

      <OptionsSheet item={picked} onClose={() => setPicked(null)} onAdd={(o) => { add(picked, o); setPicked(null); }} />
      <CartSheet open={cartOpen} onOpenChange={setCartOpen} cart={cart} setCart={setCart} taxRate={data?.taxRate ?? 0}
        onPlaced={() => { setCart([]); setCartOpen(false); qc.invalidateQueries({ queryKey: ["activity"] }); nav({ to: "/stay/trips" }); }} />
    </main>
  );
}

function Chip({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return <button onClick={onClick} className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-semibold ${active ? "bg-primary text-primary-foreground" : "bg-card text-foreground"}`}>{children}</button>;
}

function OptionsSheet({ item, onClose, onAdd }: { item: any; onClose: () => void; onAdd: (o: string[]) => void }) {
  const [sel, setSel] = useState<Record<string, string[]>>({});
  const groups = (item?.options ?? []) as Group[];
  const missing = groups.some((g) => g.required && !(sel[g.group]?.length));
  return (
    <Sheet open={!!item} onOpenChange={(o) => { if (!o) { onClose(); setSel({}); } }}>
      <SheetContent side="bottom" className="rounded-t-3xl">
        <SheetHeader><SheetTitle>{item?.name}</SheetTitle></SheetHeader>
        <div className="space-y-4 px-4 pb-4">
          {groups.map((g) => (
            <div key={g.group}>
              <div className="mb-2 text-sm font-semibold">{g.group} {g.required && <span className="text-accent">· required</span>}</div>
              <div className="flex flex-wrap gap-2">
                {g.choices.map((c) => {
                  const on = sel[g.group]?.includes(c.name);
                  return (
                    <button key={c.name} onClick={() => setSel((s) => {
                      const cur = s[g.group] ?? [];
                      return { ...s, [g.group]: g.multi ? (on ? cur.filter((x) => x !== c.name) : [...cur, c.name]) : [c.name] };
                    })} className={`rounded-full border px-3 py-1.5 text-sm ${on ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
                      {c.name}{Number(c.price) > 0 && ` +${money(c.price)}`}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <Button disabled={missing} size="lg" className="w-full rounded-full" onClick={() => { onAdd(Object.values(sel).flat()); setSel({}); }}>Add to cart</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function CartSheet({ open, onOpenChange, cart, setCart, taxRate, onPlaced }: {
  open: boolean; onOpenChange: (o: boolean) => void; cart: CartLine[]; setCart: React.Dispatch<React.SetStateAction<CartLine[]>>; taxRate: number; onPlaced: () => void;
}) {
  const [notes, setNotes] = useState("");
  const [room, setRoom] = useState("");
  const [busy, setBusy] = useState(false);
  const [key] = useState(() => crypto.randomUUID());
  const subtotal = cart.reduce((s, l) => s + l.unit * l.qty, 0);
  const tax = Math.round(subtotal * taxRate);
  async function checkout() {
    setBusy(true);
    try {
      await placeOrder({ data: { items: cart.map((l) => ({ menuItemId: l.menuItemId, qty: l.qty, options: l.options })), destinationRoom: room || undefined, notes: notes || undefined, idempotencyKey: key } });
      toast.success("Order placed — charged to your room");
      onPlaced();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-3xl">
        <SheetHeader><SheetTitle>Your order</SheetTitle></SheetHeader>
        <div className="space-y-3 px-4 pb-6">
          {cart.map((l) => (
            <div key={l.key} className="flex items-center gap-2">
              <div className="flex-1"><div className="font-semibold">{l.name}</div>{l.options.length > 0 && <div className="text-xs text-muted-foreground">{l.options.join(", ")}</div>}</div>
              <Button size="icon-sm" variant="outline" onClick={() => setCart((c) => c.flatMap((x) => x.key === l.key ? (x.qty > 1 ? [{ ...x, qty: x.qty - 1 }] : []) : [x]))}>−</Button>
              <span className="w-5 text-center">{l.qty}</span>
              <Button size="icon-sm" variant="outline" onClick={() => setCart((c) => c.map((x) => x.key === l.key ? { ...x, qty: x.qty + 1 } : x))}>+</Button>
              <span className="w-16 text-right">{money(l.unit * l.qty)}</span>
            </div>
          ))}
          <Input placeholder="Notes for the kitchen (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <Input placeholder="Send to another room? Room number (optional)" value={room} onChange={(e) => setRoom(e.target.value)} />
          <div className="space-y-1 border-t pt-3 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>{money(subtotal)}</span></div>
            <div className="flex justify-between"><span>Taxes</span><span>{money(tax)}</span></div>
            <div className="flex justify-between text-base font-bold"><span>Total</span><span>{money(subtotal + tax)}</span></div>
          </div>
          <Button disabled={busy || !cart.length} size="lg" className="w-full rounded-full" onClick={checkout}>Charge to my room · {money(subtotal + tax)}</Button>
          <p className="text-center text-xs text-muted-foreground">Final price is confirmed by the hotel when you place the order.</p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
