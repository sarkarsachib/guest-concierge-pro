import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { verifyStay } from "@/lib/guest.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type VerifyInput =
  | { method: "invite"; token: string; name?: string | undefined }
  | { method: "code"; room: string; code: string; name?: string | undefined };

export async function startStaySession(input: VerifyInput) {
  await supabase.auth.signOut();
  const r = await verifyStay({ data: input });
  if (!r.ok) return r;
  const { error } = await supabase.auth.setSession({ access_token: r.accessToken, refresh_token: r.refreshToken });
  if (error) return { ok: false as const, error: "Couldn't start your session. Please try again." };
  return { ok: true as const };
}

export function VerifyStayForm({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const [room, setRoom] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await startStaySession({ method: "code", room, code, name: name || undefined });
      if (!r.ok) { toast.error(r.error); return; }
      await qc.invalidateQueries();
      onDone();
    } catch (err: any) {
      toast.error(err?.message ?? "Something went wrong.");
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="clay flex flex-col gap-4 p-7">
      <img src="/emoji/concierge.png" alt="" className="h-16 w-16" />
      <div className="space-y-2">
        <h1 className="text-2xl font-bold leading-tight">Verify your stay</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Only guests with an active stay can enter. Use the room number and stay code from your key-card sleeve, or open the personal link reception sent you.
        </p>
      </div>
      <div className="space-y-3">
        <Input required placeholder="Room number" inputMode="numeric" value={room} onChange={(e) => setRoom(e.target.value)} />
        <Input required placeholder="Stay code" value={code} onChange={(e) => setCode(e.target.value)} />
        <Input placeholder="Your name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <Button disabled={busy} size="lg" className="w-full rounded-full">{busy ? "Verifying…" : "Enter my stay"}</Button>
    </form>
  );
}
