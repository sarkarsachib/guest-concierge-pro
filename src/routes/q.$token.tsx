import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { resolveRoomQr } from "@/lib/guest.functions";
import { HotelPublicInfo } from "./index";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/q/$token")({
  head: () => ({
    meta: [
      { title: "Welcome — Beach View" },
      { name: "description", content: "Hotel information and guest services." },
      { property: "og:title", content: "Welcome — Beach View" },
      { property: "og:description", content: "Hotel information and guest services." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: QrPage,
});

// The QR is a doorway, not an identity: it only reveals public hotel info.
function QrPage() {
  const { token } = Route.useParams();
  const { session } = useAuth();
  const { data, isLoading } = useQuery({ queryKey: ["qr", token], queryFn: () => resolveRoomQr({ data: { token } }) });
  if (isLoading) return <main className="p-10 text-center text-muted-foreground">Loading…</main>;
  if (!data) return <main className="mx-auto max-w-md p-10 text-center"><h1 className="text-2xl font-bold">This code isn't active</h1><Link className="mt-4 block text-primary" to="/">Go to hotel page</Link></main>;
  return (
    <main className="mx-auto min-h-screen max-w-md px-5 pb-12 pt-10">
      <div className="clay bg-primary p-7 text-primary-foreground">
        <p className="text-sm opacity-80">Room {data.room?.number} · {data.room?.room_type}</p>
        <h1 className="mt-1 text-3xl font-bold">Welcome to {data.hotel.name}</h1>
        <p className="mt-2 text-sm opacity-90">To order, book or see charges, verify you're a guest of this room.</p>
        <Button asChild variant="secondary" size="lg" className="mt-5 w-full rounded-full">
          {session ? <Link to="/stay">Continue</Link> : <Link to="/auth" search={{ redirect: "/stay" }}>I'm staying here</Link>}
        </Button>
      </div>
      <div className="mt-6"><HotelPublicInfo info={data.hotel.info} /></div>
    </main>
  );
}
