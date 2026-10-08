import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { createServiceRequest, getConciergeThread, placeOrder } from "@/lib/guest.functions";
import { money } from "@/lib/format";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { PromptInput, PromptInputFooter, PromptInputSubmit, PromptInputTextarea } from "@/components/ai-elements/prompt-input";
import { Tool, ToolContent, ToolHeader, ToolOutput } from "@/components/ai-elements/tool";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/stay/concierge")({
  validateSearch: z.object({ q: z.string().max(500).optional() }),
  component: ConciergePage,
});

function ConciergePage() {
  const { data: history, isLoading } = useQuery({ queryKey: ["thread"], queryFn: () => getConciergeThread(), staleTime: Infinity });
  if (isLoading) return <p className="p-10 text-center text-muted-foreground">Loading…</p>;
  return <Chat initial={(history ?? []) as UIMessage[]} />;
}

const SUGGESTIONS = ["Two extra towels please", "2 butter chicken, one biryani and 3 Coke", "Surprise me with dinner under ₹800", "I have ₹5,000 and six hours — plan my day", "Plan a romantic evening under ₹5,000"];

function Chat({ initial }: { initial: UIMessage[] }) {
  const { q } = Route.useSearch();
  const qc = useQueryClient();
  const [input, setInput] = useState("");
  const { messages, sendMessage, status, stop, error } = useChat({
    messages: initial,
    transport: new DefaultChatTransport({
      api: "/api/concierge",
      headers: async (): Promise<Record<string, string>> => {
        const { data } = await supabase.auth.getSession();
        return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
      },
    }),
    onFinish: () => qc.invalidateQueries({ queryKey: ["activity"] }),
  });
  const sentQ = useRef(false);
  useEffect(() => { if (q && !sentQ.current) { sentQ.current = true; sendMessage({ text: q }); } }, [q]);

  return (
    <main className="flex h-[calc(100dvh-7rem)] flex-col px-3 pt-4">
      <header className="flex items-center gap-3 px-1 pb-2">
        <img src="/emoji/concierge.png" alt="" className="h-11 w-11" />
        <div className="space-y-0.5"><h1 className="text-xl font-bold leading-tight">Concierge</h1><p className="text-xs leading-snug text-muted-foreground">Asks before charging anything to your room</p></div>
      </header>
      <Conversation className="clay">
        <ConversationContent>
          {!messages.length && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Try:</p>
              {SUGGESTIONS.map((s) => <button key={s} onClick={() => sendMessage({ text: s })} className="block w-full rounded-2xl bg-secondary px-4 py-2 text-left text-sm">{s}</button>)}
            </div>
          )}
          {messages.map((m) => (
            <Message key={m.id} from={m.role}>
              <MessageContent className={m.role === "user" ? "bg-primary text-primary-foreground" : ""}>
                {m.parts.map((p: any, i) => {
                  if (p.type === "text") return <MessageResponse key={i}>{p.text}</MessageResponse>;
                  if (p.type?.startsWith("tool-")) {
                    const out = p.output;
                    if (p.state === "output-available" && (out?.kind === "order" || out?.kind === "booking")) return <ProposalCard key={i} id={p.toolCallId} p={out} />;
                    return (
                      <Tool key={i} defaultOpen={false}>
                        <ToolHeader type={p.type} state={p.state} />
                        <ToolContent><ToolOutput output={out} errorText={p.errorText} /></ToolContent>
                      </Tool>
                    );
                  }
                  return null;
                })}
              </MessageContent>
            </Message>
          ))}
          {error && <p className="text-sm text-destructive">{error.message || "The concierge couldn't respond. Please try again."}</p>}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <PromptInput className="mt-3" onSubmit={(msg) => { if (msg.text?.trim()) { sendMessage({ text: msg.text }); setInput(""); } }}>
        <PromptInputTextarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask for anything…" />
        <PromptInputFooter className="justify-end">
          <PromptInputSubmit status={status} onStop={stop} disabled={!input.trim() && status === "ready"} />
        </PromptInputFooter>
      </PromptInput>
    </main>
  );
}

function ProposalCard({ id, p }: { id: string; p: any }) {
  const qc = useQueryClient();
  const storeKey = `proposal-${id}`;
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setDone(localStorage.getItem(storeKey) === "1"); }, []);
  async function confirm() {
    setBusy(true);
    try {
      if (p.kind === "order") {
        await placeOrder({ data: { items: p.lines.map((l: any) => ({ menuItemId: l.menuItemId, qty: l.qty, options: l.options })), destinationRoom: p.destinationRoom ?? undefined, notes: p.notes ?? undefined, idempotencyKey: crypto.randomUUID(), source: "concierge" } as any });
      } else {
        await createServiceRequest({ data: { module: p.module, catalogItemId: p.catalogItemId, quantity: p.quantity, scheduledFor: p.scheduledFor, details: p.details ?? undefined, source: "concierge" } });
      }
      localStorage.setItem(storeKey, "1");
      setDone(true);
      toast.success("Confirmed — charged to your room");
      qc.invalidateQueries();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }
  return (
    <div className="my-2 rounded-2xl border border-border bg-background p-4 text-sm text-foreground">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{p.kind === "order" ? `Order${p.destinationRoom ? ` → room ${p.destinationRoom}` : ""}` : "Booking"}</div>
      {p.kind === "order"
        ? p.lines.map((l: any, i: number) => <div key={i} className="flex justify-between"><span>{l.qty}× {l.name}{l.options?.length ? ` (${l.options.join(", ")})` : ""}</span><span>{money(l.unit * l.qty)}</span></div>)
        : <div className="flex justify-between"><span>{p.quantity}× {p.name}{p.scheduledFor ? ` · ${new Date(p.scheduledFor).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}` : ""}</span><span>{money(p.subtotal)}</span></div>}
      <div className="mt-2 flex justify-between border-t pt-2 font-bold"><span>Total incl. taxes</span><span>{money(p.total)}</span></div>
      <Button onClick={confirm} disabled={busy || done} className="mt-3 w-full rounded-full">{done ? "Confirmed ✓" : `Confirm & charge to room`}</Button>
    </div>
  );
}
