import { useEffect, useState } from "react";
import { Check, X, Copy, Mail, RefreshCw, AlertCircle, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { StatusPill } from "@/components/layout/StatusPill";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { shortDate } from "@/lib/format";

type Role = "landlord" | "tenant";
type Status = "pending" | "approved" | "rejected";

interface InviteRequest {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  requested_role: Role;
  note: string | null;
  status: Status;
  generated_invite_code: string | null;
  created_at: string;
  reviewed_at: string | null;
}

interface EmailStatus {
  template: "approved" | "rejected";
  status: string;
  error: string | null;
  at: string;
}

function makeCode(role: Role) {
  const r = Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
  const prefix = role === "landlord" ? "LL" : "TN";
  return `${prefix}-2026-${r}`;
}

async function sendApprovalEmail(req: InviteRequest, code: string, attempt = 0) {
  const idempotencyKey =
    attempt === 0 ? `invite-approved-${req.id}` : `invite-approved-${req.id}-r${attempt}`;
  return supabase.functions.invoke("send-transactional-email", {
    body: {
      templateName: "invite-request-approved",
      recipientEmail: req.email,
      idempotencyKey,
      templateData: {
        firstName: req.first_name,
        inviteCode: code,
        requestedRole: req.requested_role,
      },
    },
  });
}

async function sendRejectionEmail(req: InviteRequest, attempt = 0) {
  const idempotencyKey =
    attempt === 0 ? `invite-rejected-${req.id}` : `invite-rejected-${req.id}-r${attempt}`;
  return supabase.functions.invoke("send-transactional-email", {
    body: {
      templateName: "invite-request-rejected",
      recipientEmail: req.email,
      idempotencyKey,
      templateData: { firstName: req.first_name },
    },
  });
}

export default function AdminRequests() {
  const [requests, setRequests] = useState<InviteRequest[]>([]);
  const [emailStatuses, setEmailStatuses] = useState<Record<string, EmailStatus>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | Status>("pending");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [resendId, setResendId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [creatorName, setCreatorName] = useState("Admin");
  const [deleteTarget, setDeleteTarget] = useState<InviteRequest | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function loadEmailStatuses(reqs: InviteRequest[]) {
    const ids = reqs.filter((r) => r.status !== "pending").map((r) => r.id);
    if (ids.length === 0) {
      setEmailStatuses({});
      return;
    }
    const { data, error } = await supabase.functions.invoke("admin-invite-email-status", {
      body: { requestIds: ids },
    });
    if (error) {
      console.warn("email status fetch failed", error);
      return;
    }
    setEmailStatuses((data?.statuses as Record<string, EmailStatus>) ?? {});
  }

  async function load() {
    const { data: s } = await supabase.auth.getSession();
    if (s.session) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name,first_name,last_name")
        .eq("id", s.session.user.id)
        .maybeSingle();
      setCreatorName(prof?.full_name || `${prof?.first_name ?? ""} ${prof?.last_name ?? ""}`.trim() || "Admin");
    }
    const { data, error } = await supabase
      .from("invite_requests")
      .select("id,first_name,last_name,email,requested_role,note,status,generated_invite_code,created_at,reviewed_at")
      .order("created_at", { ascending: false });
    if (error) toast({ title: "Failed to load requests", description: error.message, variant: "destructive" });
    const list = (data as InviteRequest[]) ?? [];
    setRequests(list);
    setLoading(false);
    loadEmailStatuses(list);
  }

  useEffect(() => { load(); }, []);

  async function approve(req: InviteRequest) {
    setBusyId(req.id);
    const code = makeCode(req.requested_role);
    const { data: s } = await supabase.auth.getSession();
    const userId = s.session?.user.id;

    const { error: inviteErr } = await supabase.from("invite_codes").insert({
      code,
      role: req.requested_role,
      email: req.email,
      first_name: req.first_name,
      last_name: req.last_name,
      created_by_name: creatorName,
      max_uses: 1,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });
    if (inviteErr) {
      setBusyId(null);
      toast({ title: "Could not create invite", description: inviteErr.message, variant: "destructive" });
      return;
    }

    const { error: updErr } = await supabase
      .from("invite_requests")
      .update({
        status: "approved",
        reviewed_by: userId ?? null,
        reviewed_at: new Date().toISOString(),
        generated_invite_code: code,
      })
      .eq("id", req.id);

    setBusyId(null);
    if (updErr) {
      toast({ title: "Invite created but request not updated", description: updErr.message, variant: "destructive" });
    } else {
      sendApprovalEmail(req, code).catch((e) => console.warn("approval email failed", e));
      toast({ title: "Request approved", description: `Invite ${code} created for ${req.email}.` });
    }
    load();
  }

  async function reject(req: InviteRequest) {
    setBusyId(req.id);
    const { data: s } = await supabase.auth.getSession();
    const userId = s.session?.user.id;
    const { error } = await supabase
      .from("invite_requests")
      .update({
        status: "rejected",
        reviewed_by: userId ?? null,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", req.id);
    setBusyId(null);
    if (error) toast({ title: "Could not reject", description: error.message, variant: "destructive" });
    else {
      sendRejectionEmail(req).catch((e) => console.warn("rejection email failed", e));
      toast({ title: "Request rejected" });
    }
    load();
  }

  async function resend(req: InviteRequest) {
    setResendId(req.id);
    try {
      // Use a fresh idempotency key so the queue accepts a new send
      const attempt = Date.now();
      const { error } =
        req.status === "approved"
          ? await sendApprovalEmail(req, req.generated_invite_code ?? "", attempt)
          : await sendRejectionEmail(req, attempt);
      if (error) throw error;
      toast({ title: "Email resent", description: `Sent to ${req.email}.` });
      // Give the queue a moment then refresh statuses
      setTimeout(() => loadEmailStatuses(requests), 1500);
    } catch (e) {
      toast({ title: "Resend failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setResendId(null);
    }
  }

  async function copyCode(code: string) {
    await navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 1500);
  }

  function emailStatusTone(s?: EmailStatus): "success" | "danger" | "warning" | "muted" {
    if (!s) return "muted";
    if (s.status === "sent") return "success";
    if (s.status === "pending") return "warning";
    if (s.status === "suppressed") return "warning";
    return "danger"; // failed, dlq, bounced, complained
  }

  const filtered = requests.filter((r) => filter === "all" || r.status === filter);
  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <AdminLayout crumbs={["Requests"]}>
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">Invite requests</h1>
      <p className="text-muted-foreground mt-1.5 text-sm">
        Review prospective customers who have requested access. Approving creates a single-use invite code.
      </p>

      <div className="rounded-xl border border-border bg-card overflow-x-auto mt-6">
        <div className="px-6 py-5 border-b border-border flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-foreground">Requests</h2>
            <p className="text-xs text-muted-foreground mt-1">
              {filtered.length} shown · {pendingCount} pending
            </p>
          </div>
          <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              <th className="text-left font-medium px-6 py-3">Requester</th>
              <th className="text-left font-medium px-6 py-3">Role</th>
              <th className="text-left font-medium px-6 py-3">Note</th>
              <th className="text-left font-medium px-6 py-3">Submitted</th>
              <th className="text-left font-medium px-6 py-3">Status</th>
              <th className="text-left font-medium px-6 py-3">Last email</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">No requests.</td></tr>
            ) : filtered.map((r) => {
              const es = emailStatuses[r.id];
              return (
                <tr key={r.id} className="border-t border-border align-top">
                  <td className="px-6 py-3">
                    <div className="text-foreground font-medium">{r.first_name} {r.last_name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Mail className="w-3 h-3" /> {r.email}
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <StatusPill tone={r.requested_role === "landlord" ? "success" : "muted"}>
                      {r.requested_role}
                    </StatusPill>
                  </td>
                  <td className="px-6 py-3 text-muted-foreground max-w-xs">
                    {r.note ? <span className="line-clamp-3">{r.note}</span> : "—"}
                  </td>
                  <td className="px-6 py-3 text-muted-foreground">{shortDate(r.created_at)}</td>
                  <td className="px-6 py-3">
                    <StatusPill tone={r.status === "approved" ? "success" : r.status === "rejected" ? "danger" : "info"}>
                      {r.status}
                    </StatusPill>
                    {r.status === "approved" && r.generated_invite_code && (
                      <div className="mt-2 flex items-center gap-2">
                        <code className="font-mono text-xs px-2 py-1 rounded bg-muted">{r.generated_invite_code}</code>
                        <Button variant="ghost" size="sm" onClick={() => copyCode(r.generated_invite_code!)}>
                          {copied === r.generated_invite_code ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        </Button>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-3">
                    {r.status === "pending" ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : es ? (
                      <div className="space-y-1">
                        <StatusPill tone={emailStatusTone(es)}>{es.status}</StatusPill>
                        <div className="text-[11px] text-muted-foreground">{shortDate(es.at)}</div>
                        {es.error && (
                          <div className="text-[11px] text-destructive flex items-start gap-1 max-w-[200px]">
                            <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                            <span className="line-clamp-2">{es.error}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">No record</span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-right whitespace-nowrap">
                    {r.status === "pending" ? (
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => reject(r)} disabled={busyId === r.id}>
                          <X className="w-3.5 h-3.5 mr-1" /> Reject
                        </Button>
                        <Button size="sm" onClick={() => approve(r)} disabled={busyId === r.id}>
                          <Check className="w-3.5 h-3.5 mr-1" />
                          {busyId === r.id ? "Approving…" : "Approve"}
                        </Button>
                      </div>
                    ) : (
                      <div className="flex justify-end items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => resend(r)}
                          disabled={resendId === r.id || (r.status === "approved" && !r.generated_invite_code)}
                          title={r.status === "approved" ? "Resend approval email" : "Resend rejection email"}
                        >
                          <RefreshCw className={`w-3.5 h-3.5 mr-1 ${resendId === r.id ? "animate-spin" : ""}`} />
                          {resendId === r.id ? "Sending…" : "Resend email"}
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}
