import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { startStaySession } from "@/components/guest/verify-stay";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/join/$token")({
  head: () => ({
    meta: [
      { title: "Join your stay — Beach View" },
      { name: "description", content: "Open your personal guest link from reception." },
      { property: "og:title", content: "Join your stay — Beach View" },
      { property: "og:description", content: "Open your personal guest link from reception." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: JoinPage,
});

function JoinPage() {
  const { token } = Route.useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    startStaySession({ method: "invite", token })
      .then(async (r) => {
        if (!r.ok) { setError(r.error); return; }
        await qc.invalidateQueries();
        nav({ to: "/stay", replace: true });
      })
      .catch((e) => setError(e?.message ?? "Something went wrong."));
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 text-center">
      <div className="clay flex flex-col items-center gap-3 p-7">
        {error ? (
          <>
            <h1 className="text-2xl font-bold">Link didn't work</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">{error}</p>
            <Button asChild size="lg" className="mt-2 w-full rounded-full"><Link to="/auth">Use room number & stay code</Link></Button>
          </>
        ) : <p className="text-muted-foreground">Verifying your stay…</p>}
      </div>
    </main>
  );
}
