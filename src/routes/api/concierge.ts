import { createFileRoute } from "@tanstack/react-router";
import { handleConcierge } from "@/lib/concierge.server";

export const Route = createFileRoute("/api/concierge")({
  server: { handlers: { POST: ({ request }) => handleConcierge(request) } },
});
