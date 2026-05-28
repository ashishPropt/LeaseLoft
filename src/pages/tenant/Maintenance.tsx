import { useEffect, useRef, useState } from "react";
import { Bot, Plus, Send, Wrench } from "lucide-react";
import { TenantLayout } from "@/components/layout/TenantLayout";
import { StatusPill } from "@/components/layout/StatusPill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useTenantContext } from "@/lib/useTenantContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { monthDay } from "@/lib/format";
import { randomUUID } from "@/lib/device";
import { cn } from "@/lib/utils";

interface Item {
  id: string; title: string; description: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  status: "open" | "in_progress" | "resolved" | "closed";
  created_at: string;
}

interface ChatMessage { role: "user" | "assistant"; content: string }

type Step = "initial" | "chatting" | "summary";

const SUMMARY_MARKER = "---SUMMARY---";

const tone  = { open: "warning", in_progress: "info", resolved: "success", closed: "muted" } as const;
const label = { open: "Open", in_progress: "In progress", resolved: "Resolved", closed: "Closed" } as const;

/** Guess priority from the AI-generated summary text */
function detectPriority(text: string): Item["priority"] {
  const t = text.toLowerCase();
  if (/emergency|gas\s*leak|flood|no\s*heat|fire|sparks?|unsafe|hazard/.test(t)) return "urgent";
  if (/not\s*working|broken|significant\s*leak|electrical|no\s*hot\s*water|water\s*damage/.test(t)) return "high";
  return "medium";
}

/** Split AI response into chat text + optional summary */
function parseResponse(text: string): { chat: string; summary?: string } {
  const idx = text.indexOf(SUMMARY_MARKER);
  if (idx === -1) return { chat: text.trim() };
  const chat    = text.slice(0, idx).trim();
  const summary = text.slice(idx + SUMMARY_MARKER.length).trim();
  return { chat: chat || "I have enough detail now. Here's a summary of your issue:", summary };
}

/** Base URL for the LeaseLoft API server */
const API_BASE = "/api";

export default function TenantMaintenance() {
  const { ctx } = useTenantContext();
  const [items, setItems]     = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen]       = useState(false);

  // Wizard state
  const [step, setStep]             = useState<Step>("initial");
  const [title, setTitle]           = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput]   = useState("");
  const [aiLoading, setAiLoading]   = useState(false);
  const [summary, setSummary]       = useState("");
  const [priority, setPriority]     = useState<Item["priority"]>("medium");
  const [submitting, setSubmitting] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  // ── Data load ─────────────────────────────────────────────────────────────
  async function load() {
    if (!ctx?.lease) { setLoading(false); return; }
    const { data } = await supabase
      .from("maintenance_requests")
      .select("id,title,description,priority,status,created_at")
      .eq("lease_id", ctx.lease.id)
      .order("created_at", { ascending: false });
    setItems((data as Item[]) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [ctx?.lease?.id]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, aiLoading]);

  // Focus input when chatting
  useEffect(() => {
    if (step === "chatting") setTimeout(() => inputRef.current?.focus(), 100);
  }, [step, chatMessages]);

  // ── Reset wizard on dialog close ──────────────────────────────────────────
  function handleOpenChange(v: boolean) {
    setOpen(v);
    if (!v) resetWizard();
  }
  function resetWizard() {
    setStep("initial"); setTitle(""); setChatMessages([]);
    setChatInput(""); setSummary(""); setPriority("medium");
  }

  // ── Call the LeaseLoft API server ─────────────────────────────────────────
  async function callAI(messages: ChatMessage[]): Promise<string> {
    const res = await fetch(`${API_BASE}/maintenance-chat`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ title, messages }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Chat error ${res.status}: ${err}`);
    }
    const data = await res.json();
    return (data as { message: string }).message ?? "";
  }

  // ── Step 1 → Start chat ───────────────────────────────────────────────────
  async function startChat() {
    if (!title.trim()) return toast({ title: "Please describe the issue first", variant: "destructive" });
    setStep("chatting");
    setAiLoading(true);
    try {
      const raw = await callAI([]);
      const { chat, summary: s } = parseResponse(raw);
      setChatMessages([{ role: "assistant", content: chat }]);
      if (s) { setSummary(s); setPriority(detectPriority(s)); setStep("summary"); }
    } catch (e: any) {
      toast({ title: "Could not connect to assistant", description: e?.message, variant: "destructive" });
      setStep("initial");
    } finally {
      setAiLoading(false);
    }
  }

  // ── Step 2 → Send message ─────────────────────────────────────────────────
  async function sendMessage() {
    const text = chatInput.trim();
    if (!text || aiLoading) return;
    setChatInput("");

    const userMsg: ChatMessage = { role: "user", content: text };
    const updated = [...chatMessages, userMsg];
    setChatMessages(updated);
    setAiLoading(true);

    try {
      const raw = await callAI(updated);
      const { chat, summary: s } = parseResponse(raw);
      setChatMessages(prev => [...prev, { role: "assistant", content: chat }]);
      if (s) {
        await new Promise(r => setTimeout(r, 600));
        setSummary(s);
        setPriority(detectPriority(s));
        setStep("summary");
      }
    } catch (e: any) {
      toast({ title: "Assistant error", description: e?.message, variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  // ── Step 3 → Submit ───────────────────────────────────────────────────────
  async function submit() {
    if (!ctx?.lease || !ctx.userId) return;
    setSubmitting(true);
    let submitError: any = null;
    try {
      const newId = randomUUID();
      const { error } = await supabase.from("maintenance_requests").insert({
        id:          newId,
        lease_id:    ctx.lease.id,
        created_by:  ctx.userId,
        title:       title.trim(),
        description: summary.trim() || null,
        priority,
      });
      submitError = error;

      if (!error) {
        toast({ title: "Request submitted" });
        setOpen(false);
        resetWizard();
        load();

        // Notify landlord — fire and forget
        const leaseId     = ctx.lease.id;
        const userId      = ctx.userId;
        const capTitle    = title;
        const capDesc     = summary;
        const capPriority = priority;
        void (async () => {
          try {
            const [{ data: lease }, { data: tenantProf }] = await Promise.all([
              supabase.from("leases").select("landlord_id,unit_id").eq("id", leaseId).maybeSingle(),
              supabase.from("profiles").select("full_name,first_name,last_name,email").eq("id", userId).maybeSingle(),
            ]);
            if (!lease?.landlord_id) return;
            const [{ data: landlordProf }, { data: unit }] = await Promise.all([
              supabase.from("profiles").select("email,full_name,first_name").eq("id", lease.landlord_id).maybeSingle(),
              supabase.from("units").select("label,property_id").eq("id", lease.unit_id).maybeSingle(),
            ]);
            const { data: prop } = unit?.property_id
              ? await supabase.from("properties").select("name").eq("id", unit.property_id).maybeSingle()
              : { data: null as any };
            if (!landlordProf?.email) return;
            const tenantName   = tenantProf?.full_name || `${tenantProf?.first_name ?? ""} ${tenantProf?.last_name ?? ""}`.trim() || "Your tenant";
            const landlordName = landlordProf.full_name || landlordProf.first_name || "";
            await Promise.race([
              supabase.functions.invoke("send-transactional-email", {
                body: {
                  templateName:   "maintenance-request-created",
                  recipientEmail: landlordProf.email,
                  idempotencyKey: `maint-created-${newId}`,
                  templateData: {
                    landlordName, tenantName,
                    unitLabel:    unit?.label ?? "",
                    propertyName: prop?.name ?? "",
                    title:        capTitle,
                    description:  capDesc || "",
                    priority:     capPriority[0].toUpperCase() + capPriority.slice(1),
                  },
                },
              }),
              new Promise((_, reject) => setTimeout(() => reject(new Error("email timeout")), 10_000)),
            ]);
          } catch (e) { console.error("notify landlord failed", e); }
        })();
      }
    } catch (e: any) {
      submitError = e;
    } finally {
      setSubmitting(false);
    }
    if (submitError) {
      toast({ title: "Could not submit", description: submitError?.message || String(submitError), variant: "destructive" });
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <TenantLayout crumbs={["Maintenance"]}>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Maintenance</h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            {items.filter(i => i.status === "open" || i.status === "in_progress").length} open requests
          </p>
        </div>

        {ctx?.lease && (
          <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" />New request</Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-lg p-0 overflow-hidden gap-0">

              {/* ── Step 1: Describe the issue ──────────────────────────── */}
              {step === "initial" && (
                <>
                  <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
                    <DialogTitle>Report an issue</DialogTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Describe what's wrong and our assistant will ask a few quick questions.
                    </p>
                  </DialogHeader>
                  <div className="px-6 py-5 space-y-4">
                    <div>
                      <Label className="mb-1.5 block">What's the issue?</Label>
                      <Input
                        autoFocus
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && startChat()}
                        placeholder="e.g. Leaking kitchen faucet, AC not cooling, Door won't lock"
                        className="text-sm"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Your answers help your landlord and vendors respond faster.
                    </p>
                  </div>
                  <div className="px-6 pb-5 flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button onClick={startChat} disabled={!title.trim()}>
                      Let's get the details →
                    </Button>
                  </div>
                </>
              )}

              {/* ── Step 2: Chat ──────────────────────────────────────────── */}
              {step === "chatting" && (
                <>
                  <DialogHeader className="px-5 pt-5 pb-3 border-b border-border">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                        <Bot className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <DialogTitle className="text-sm leading-tight">{title}</DialogTitle>
                        <p className="text-xs text-muted-foreground">Answering a few questions helps vendors quote accurately</p>
                      </div>
                    </div>
                  </DialogHeader>

                  {/* Messages */}
                  <div className="px-4 py-3 space-y-3 overflow-y-auto max-h-72 min-h-40 bg-muted/20">
                    {chatMessages.map((msg, i) => (
                      <div key={i} className={cn("flex items-end gap-2", msg.role === "user" ? "justify-end" : "justify-start")}>
                        {msg.role === "assistant" && (
                          <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mb-0.5">
                            <Bot className="w-3.5 h-3.5 text-blue-600" />
                          </div>
                        )}
                        <div className={cn(
                          "max-w-[82%] px-3.5 py-2.5 text-sm rounded-2xl",
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground rounded-br-sm"
                            : "bg-card border border-border rounded-bl-sm"
                        )}>
                          {msg.content}
                        </div>
                      </div>
                    ))}

                    {/* Typing indicator */}
                    {aiLoading && (
                      <div className="flex items-end gap-2">
                        <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                          <Bot className="w-3.5 h-3.5 text-blue-600" />
                        </div>
                        <div className="bg-card border border-border rounded-2xl rounded-bl-sm px-4 py-3">
                          <div className="flex gap-1 items-center">
                            {[0, 150, 300].map(d => (
                              <div key={d} className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce"
                                style={{ animationDelay: `${d}ms` }} />
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={bottomRef} />
                  </div>

                  {/* Input row */}
                  <div className="px-4 pb-4 pt-2 border-t border-border bg-background flex gap-2">
                    <Input
                      ref={inputRef}
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Type your reply…"
                      disabled={aiLoading}
                      className="text-sm"
                    />
                    <Button size="icon" onClick={sendMessage} disabled={!chatInput.trim() || aiLoading}>
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </>
              )}

              {/* ── Step 3: Summary review + submit ──────────────────────── */}
              {step === "summary" && (
                <>
                  <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                        <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div>
                        <DialogTitle className="text-sm">Review your request</DialogTitle>
                        <p className="text-xs text-muted-foreground">Edit if anything needs adjusting</p>
                      </div>
                    </div>
                  </DialogHeader>

                  <div className="px-6 py-5 space-y-4">
                    <div>
                      <Label className="mb-1.5 block text-xs text-muted-foreground uppercase tracking-wide">Issue</Label>
                      <p className="text-sm font-medium text-foreground">{title}</p>
                    </div>

                    <div>
                      <Label className="mb-1.5 block text-xs text-muted-foreground uppercase tracking-wide">
                        Summary <span className="normal-case text-muted-foreground/70">(sent to your landlord &amp; vendors)</span>
                      </Label>
                      <Textarea
                        rows={5}
                        value={summary}
                        onChange={e => setSummary(e.target.value)}
                        className="text-sm resize-none"
                      />
                    </div>

                    <div>
                      <Label className="mb-1.5 block text-xs text-muted-foreground uppercase tracking-wide">Priority</Label>
                      <Select value={priority} onValueChange={v => setPriority(v as Item["priority"])}>
                        <SelectTrigger className="text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low — whenever convenient</SelectItem>
                          <SelectItem value="medium">Medium — within a few days</SelectItem>
                          <SelectItem value="high">High — needs attention soon</SelectItem>
                          <SelectItem value="urgent">Urgent — emergency</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="px-6 pb-5 flex justify-between gap-2 border-t border-border pt-4">
                    <Button variant="outline" onClick={() => setStep("chatting")}>
                      ← Add more details
                    </Button>
                    <Button onClick={submit} disabled={submitting || !summary.trim()}>
                      {submitting ? "Submitting…" : "Submit request"}
                    </Button>
                  </div>
                </>
              )}

            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Requests table */}
      <div className="rounded-xl border border-border bg-card mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              <th className="text-left font-medium px-6 py-4">Issue</th>
              <th className="text-left font-medium px-6 py-4">Priority</th>
              <th className="text-left font-medium px-6 py-4">Submitted</th>
              <th className="text-left font-medium px-6 py-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">Loading…</td></tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-16 text-center text-muted-foreground">
                  <Wrench className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  No requests yet.
                </td>
              </tr>
            ) : items.map(it => (
              <tr key={it.id} className="border-t border-border">
                <td className="px-6 py-4">
                  <div className="font-medium text-foreground">{it.title}</div>
                  {it.description && (
                    <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{it.description}</div>
                  )}
                </td>
                <td className="px-6 py-4">
                  <StatusPill tone={it.priority === "urgent" || it.priority === "high" ? "danger" : it.priority === "medium" ? "warning" : "muted"} dot={false}>
                    {it.priority[0].toUpperCase() + it.priority.slice(1)}
                  </StatusPill>
                </td>
                <td className="px-6 py-4 text-muted-foreground">{monthDay(it.created_at)}</td>
                <td className="px-6 py-4"><StatusPill tone={tone[it.status]}>{label[it.status]}</StatusPill></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </TenantLayout>
  );
}
