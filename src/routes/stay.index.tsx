import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { stayQuery } from "./stay";
import { moduleMeta } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/stay/")({ component: StayHome });

function StayHome() {
  const { data } = useQuery(stayQuery);
  if (!data) return null;
  const { stay, hotel } = data as any;
  const me = data.guests.find((g: any) => g.id === data.me);
  const modules = hotel.modules ?? {};
  const services = Object.keys(moduleMeta).filter((m) => m !== "restaurant" && modules[m]);
  const wifi = hotel.info?.wifi;
  return (
    <main className="space-y-5 px-4 pt-6">
      <header className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{hotel.name} · Room {stay.rooms?.number}</p>
          <h1 className="text-3xl font-bold">Hello, {me?.display_name?.split(" ")[0] || `Room ${stay.rooms?.number} Guest`}</h1>
        </div>
        <button className="text-xs text-muted-foreground" onClick={() => supabase.auth.signOut()}>Sign out</button>
      </header>

      <Link to="/stay/concierge" className="clay flex items-center gap-4 bg-primary p-5 text-primary-foreground">
        <img src="/emoji/concierge.png" alt="" className="h-14 w-14" />
        <div><div className="font-display text-lg font-semibold">Ask the concierge</div><div className="text-sm opacity-85">"Two towels please" · "Dinner for two at 8" · "Plan my day under ₹5,000"</div></div>
      </Link>

      {modules.restaurant && (
        <Link to="/stay/dine" className="clay flex items-center gap-4 p-5">
          <img src="/emoji/restaurant.png" alt="" className="h-14 w-14" />
          <div><div className="font-display text-lg font-semibold">In-room dining</div><div className="text-sm text-muted-foreground">Order to your room, charged to your folio</div></div>
        </Link>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold">Services</h2>
        <div className="grid grid-cols-3 gap-3">
          {services.map((m) => (
            <Link key={m} to="/stay/services/$module" params={{ module: m }} className="clay flex flex-col items-center p-3 text-center">
              <img src={`/emoji/${moduleMeta[m]!.emoji}.png`} alt="" className="h-12 w-12" />
              <span className="mt-1 text-xs font-semibold">{moduleMeta[m]!.label}</span>
            </Link>
          ))}
        </div>
      </section>

      {wifi && (
        <section className="clay p-5 text-sm">
          <h2 className="text-lg font-semibold">Wi-Fi</h2>
          <p className="mt-2">Network: <b>{wifi.network}</b></p>
          <p>Password: <b>{wifi.password}</b></p>
        </section>
      )}
    </main>
  );
}
