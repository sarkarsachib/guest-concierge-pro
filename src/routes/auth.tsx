import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/auth")({
  validateSearch: z.object({ redirect: z.string().startsWith("/").optional() }),
  head: () => ({
    meta: [
      { title: "Sign in — Beach View" },
      { name: "description", content: "Sign in to access your Beach View stay." },
      { property: "og:title", content: "Sign in — Beach View" },
      { property: "og:description", content: "Sign in to access your Beach View stay." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { redirect } = Route.useSearch();
  const target = redirect ?? "/stay";
  const nav = useNavigate();
  const { session } = useAuth();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (session) nav({ to: target as any, replace: true }); }, [session]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = mode === "in"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}${target}` } });
    setBusy(false);
    if (error) return toast.error(error.message);
    if (mode === "up") toast.success("Check your email to confirm your account.");
  }

  async function google() {
    sessionStorage.setItem("post-auth", target);
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: `${window.location.origin}/auth?redirect=${encodeURIComponent(target)}` });
    if (r.error) toast.error(r.error.message);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5">
      <div className="clay p-7">
        <img src="/emoji/concierge.png" alt="" className="h-16 w-16" />
        <h1 className="mt-3 text-3xl font-bold">{mode === "in" ? "Welcome back" : "Create your guest account"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your own account keeps your orders and charges private, even if you share a room.</p>
        <Button onClick={google} variant="outline" className="mt-6 w-full rounded-full">Continue with Google</Button>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <Input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input type="password" required minLength={6} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <Button disabled={busy} className="w-full rounded-full" size="lg">{mode === "in" ? "Sign in" : "Sign up"}</Button>
        </form>
        <button className="mt-4 w-full text-sm text-primary" onClick={() => setMode(mode === "in" ? "up" : "in")}>
          {mode === "in" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>
      </div>
    </main>
  );
}
