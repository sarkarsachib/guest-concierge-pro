import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { getMyStay } from "@/lib/guest.functions";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

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
  // Session exists but no active stay (checked out / revoked): end the session.
  useEffect(() => {
    if (session && !isLoading && data === null) {
      toast.info("Your stay is no longer active.");
      void supabase.auth.signOut();
    }
  }, [session, isLoading, data]);

  if (loading || !session || isLoading || !data) return <main className="p-10 text-center text-muted-foreground">Loading your stay…</main>;

  return (
    <div className="mx-auto min-h-screen max-w-md pb-28">
      <Outlet />
      <nav className="fixed inset-x-0 bottom-3 z-40 mx-auto max-w-md px-3">
        <div className="clay flex justify-between gap-1 px-2 py-2">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} activeOptions={{ exact: "exact" in n }}
              className="flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-1.5 text-[11px] font-semibold leading-tight text-muted-foreground"
              activeProps={{ className: "bg-secondary text-foreground" }}>
              <img src={`/emoji/${n.icon}.png`} alt="" className="h-7 w-7" />{n.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
