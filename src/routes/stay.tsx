import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getMyStay, joinWithCode } from "@/lib/guest.functions";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/stay")({
  head: () => ({
    meta: [
      { title: "My stay — Beach View" },
      { name: "description", content: "Your Beach View stay: services, dining, concierge and folio." },
      { property: "og:title", content: "My stay — Beach View" },
      { property: "og:description", content: "Your Beach View stay: services, dining, concierge and folio." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StayLayout,
});

export const stayQuery = { queryKey: ["stay"], queryFn: () => getMyStay() };

const NAV = [
  { to: "/stay", label: "Home", icon: "home", exact: true },
  { to: "/stay/dine", label: "Dine", icon: "restaurant" },
  { to: "/stay/concierge", label: "Concierge", icon: "concierge" },
  { to: "/stay/trips", label: "My Stay", icon: "mystay" },
  { to: "/stay/folio", label: "Folio", icon: "folio" },
] as const;

function StayLayout() {
  const { session, loading } = useAuth();
  const nav = useNavigate();
  useEffect(() => {
    if (!loading && !session) nav({ to: "/auth", search: { redirect: "/stay" }, replace: true });
  }, [loading, session]);
  const { data, isLoading } = useQuery({ ...stayQuery, enabled: !!session });

  if (loading || !session || isLoading) return <main className="p-10 text-center text-muted-foreground">Loading your stay…</main>;
  if (!data) return <LinkStay />;

  return (
    <div className="mx-auto min-h-screen max-w-md pb-28">
      <Outlet />
      <nav className="fixed inset-x-0 bottom-3 z-40 mx-auto max-w-md px-3">
        <div className="clay flex justify-between px-2 py-2">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} activeOptions={{ exact: "exact" in n }}
              className="flex flex-1 flex-col items-center rounded-2xl py-1 text-[11px] font-semibold text-muted-foreground"
              activeProps={{ className: "bg-secondary text-foreground" }}>
              <img src={`/emoji/${n.icon}.png`} alt="" className="h-7 w-7" />{n.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}

function LinkStay() {
  const qc = useQueryClient();
  const [room, setRoom] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await joinWithCode({ data: { room, code } });
      if (!r.ok) toast.error(r.error); else qc.invalidateQueries();
    } catch (err: any) { toast.error(err.message); } finally { setBusy(false); }
  }
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5">
      <form onSubmit={submit} className="clay space-y-3 p-7">
        <img src="/emoji/phone.png" alt="" className="h-16 w-16" />
        <h1 className="text-2xl font-bold">Link your stay</h1>
        <p className="text-sm text-muted-foreground">Enter your room number and the stay code from your key-card sleeve, or open the personal link reception sent you.</p>
        <Input required placeholder="Room number" inputMode="numeric" value={room} onChange={(e) => setRoom(e.target.value)} />
        <Input required placeholder="Stay code" value={code} onChange={(e) => setCode(e.target.value)} />
        <Button disabled={busy} size="lg" className="w-full rounded-full">Link stay</Button>
      </form>
    </main>
  );
}
