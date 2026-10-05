import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { claimInvite } from "@/lib/guest.functions";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/join/$token")({
  head: () => ({
    meta: [
      { title: "Join your stay — Beach View" },
      { name: "description", content: "Link your personal guest invitation to your account." },
      { property: "og:title", content: "Join your stay — Beach View" },
      { property: "og:description", content: "Link your personal guest invitation to your account." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: JoinPage,
});

function JoinPage() {
  const { token } = Route.useParams();
  const { session, loading } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (loading) return;
    if (!session) { nav({ to: "/auth", search: { redirect: `/join/${token}` }, replace: true }); return; }
    if (ran.current) return;
    ran.current = true;
    claimInvite({ data: { token } }).then((r) => {
      if (r.ok) { qc.invalidateQueries(); nav({ to: "/stay", replace: true }); } else setError(r.error);
    }).catch((e) => setError(e.message));
  }, [loading, session]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 text-center">
      <div className="clay p-7">
        {error ? (
          <><h1 className="text-2xl font-bold">Link didn't work</h1><p className="mt-2 text-muted-foreground">{error}</p>
            <Button asChild className="mt-5 rounded-full"><Link to="/stay">Enter room & stay code instead</Link></Button></>
        ) : <p className="text-muted-foreground">Linking your stay…</p>}
      </div>
    </main>
  );
}
