import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getPublicHotel } from "@/lib/guest.functions";
import { HOTEL_SLUG } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { HotelPublicInfo } from "@/components/guest/hotel-info";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Beach View — Guest app" },
      { name: "description", content: "Your Beach View stay in one place: dining, spa, housekeeping, AI concierge and your folio." },
      { property: "og:title", content: "Beach View — Guest app" },
      { property: "og:description", content: "Dining, spa, housekeeping, AI concierge and your folio — no download needed." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { session } = useAuth();
  const { data: hotel } = useQuery({ queryKey: ["hotel", HOTEL_SLUG], queryFn: () => getPublicHotel({ data: { slug: HOTEL_SLUG } }) });
  return (
    <main className="mx-auto min-h-screen max-w-md px-5 pb-12 pt-10">
      <div className="clay bg-primary p-7 text-primary-foreground">
        <img src="/emoji/sun.png" alt="" className="h-20 w-20" />
        <h1 className="mt-4 text-4xl font-bold leading-tight">{hotel?.name ?? "Beach View"}</h1>
        <p className="mt-2 opacity-90">{hotel?.tagline ?? "Your stay, one tap away."}</p>
        <Button asChild size="lg" variant="secondary" className="mt-6 w-full rounded-full">
          {session ? <Link to="/stay">Open my stay</Link> : <Link to="/auth" search={{ redirect: "/stay" }}>Verify my stay</Link>}
        </Button>
      </div>
      <p className="my-6 text-center text-sm text-muted-foreground">Staying with us? Open the personal link from reception, or verify with your room number and stay code.</p>
      {hotel && <HotelPublicInfo info={hotel.info} />}
    </main>
  );
}
