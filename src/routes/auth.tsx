import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { VerifyStayForm } from "@/components/guest/verify-stay";

export const Route = createFileRoute("/auth")({
  validateSearch: z.object({ redirect: z.string().startsWith("/").optional() }),
  head: () => ({
    meta: [
      { title: "Verify your stay — Beach View" },
      { name: "description", content: "Guests with an active stay verify with their room number and stay code." },
      { property: "og:title", content: "Verify your stay — Beach View" },
      { property: "og:description", content: "Guests with an active stay verify with their room number and stay code." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { redirect } = Route.useSearch();
  const nav = useNavigate();
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10">
      <VerifyStayForm onDone={() => nav({ to: (redirect ?? "/stay") as any, replace: true })} />
    </main>
  );
}
