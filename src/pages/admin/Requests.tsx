import { useEffect, useState } from "react";
import { Check, X, Copy, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { StatusPill } from "@/components/layout/StatusPill";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

function makeCode(role: Role) {
  const r = Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
  const prefix = role === "landlord" ? "LL" : "TN";
  return `${prefix}-2026-${r}`;
}

export default function AdminRequests() {
  const [requests, setRequests] = useState<InviteRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | Status>("pending");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [creatorName, setCreatorName] = useState("Admin");

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
    setRequests((data as InviteRequest[]) ?? []);
    setLoading(false);
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
    else toast({ title: "Request rejected" });
    load();
  }

  async function copyCode(code: string) {
    await navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 1500);
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
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">No requests.</td></tr>
            ) : filtered.map((r) => (
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
                    <span className="text-xs text-muted-foreground">
                      {r.reviewed_at ? shortDate(r.reviewed_at) : ""}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}
