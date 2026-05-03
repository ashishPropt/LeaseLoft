import { useEffect, useMemo, useState } from "react";
import { History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LandlordLayout } from "@/components/layout/LandlordLayout";
import { StatusPill } from "@/components/layout/StatusPill";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { money, shortDate } from "@/lib/format";

interface Row {
  id: string;
  tenant: string;
  tenantId: string;
  unit: string;
  unitId: string;
  leaseId: string;
  leaseLabel: string;
  due: string;
  paid: string | null;
  amount: number;
  method: string | null;
  status: string;
}

interface AuditEntry {
  id: string;
  changed_by: string;
  old_status: string | null;
  new_status: string;
  old_method: string | null;
  new_method: string | null;
  reason: string | null;
  created_at: string;
}

export default function LandlordPayments() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "paid" | "pending" | "failed">("all");
  const [loading, setLoading] = useState(true);

  // Edit dialog state
  const [editing, setEditing] = useState<Row | null>(null);
  const [editStatus, setEditStatus] = useState<"paid" | "pending" | "failed">("paid");
  const [editMethod, setEditMethod] = useState<string>("manual");
  const [editReason, setEditReason] = useState("");
  const [saving, setSaving] = useState(false);

  // History dialog state
  const [historyFor, setHistoryFor] = useState<Row | null>(null);
  const [history, setHistory] = useState<AuditEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: s } = await supabase.auth.getSession();
    if (!s.session) return;
    const uid = s.session.user.id;

    const { data: leases } = await supabase
      .from("leases")
      .select("id,tenant_id,unit_id")
      .eq("landlord_id", uid);

    const leaseIds = (leases ?? []).map(l => l.id);
    if (leaseIds.length === 0) { setRows([]); setLoading(false); return; }

    const [{ data: pays }, { data: units }, { data: profiles }] = await Promise.all([
      supabase.from("payments").select("*").in("lease_id", leaseIds).order("due_date", { ascending: true }),
      supabase.from("units").select("id,label,property_id"),
      supabase.from("profiles").select("id,full_name,first_name,last_name,email").in("id", Array.from(new Set((leases ?? []).map(l => l.tenant_id)))),
    ]);

    const { data: props } = await supabase.from("properties").select("id,name");

    const unitById = new Map((units ?? []).map(u => [u.id, u]));
    const propById = new Map((props ?? []).map(p => [p.id, p]));
    const tenantById = new Map((profiles ?? []).map(p => [p.id, p.full_name || `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || p.email]));
    const leaseById = new Map((leases ?? []).map(l => [l.id, l]));

    setRows((pays ?? []).map(p => {
      const lease = leaseById.get(p.lease_id);
      const unit = lease ? unitById.get(lease.unit_id) : undefined;
      const prop = unit ? propById.get(unit.property_id) : undefined;
      return {
        id: p.id,
        tenant: tenantById.get(lease?.tenant_id ?? "") ?? "Tenant",
        unit: `${prop?.name ?? "—"} · ${unit?.label ?? ""}`,
        due: p.due_date,
        paid: p.paid_at,
        amount: Number(p.amount),
        method: p.method,
        status: p.status,
      };
    }));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => rows.filter(r => {
    if (filter !== "all" && r.status !== filter) return false;
    if (q && !`${r.tenant} ${r.unit}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [rows, q, filter]);

  const openEdit = (r: Row) => {
    setEditing(r);
    setEditStatus("paid");
    setEditMethod(r.method ?? "manual");
    setEditReason("");
  };

  const submitEdit = async () => {
    if (!editing) return;
    if (!editReason.trim()) {
      toast({ title: "Reason required", description: "Please provide a reason for this change.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.rpc("landlord_update_payment_status", {
      _payment_id: editing.id,
      _new_status: editStatus,
      _method: editMethod,
      _reason: editReason.trim(),
    });
    setSaving(false);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Payment updated", description: `Status set to ${editStatus}.` });
    setEditing(null);
    load();
  };

  const openHistory = async (r: Row) => {
    setHistoryFor(r);
    setHistory([]);
    setHistoryLoading(true);
    const { data } = await supabase
      .from("payment_status_audit")
      .select("id,changed_by,old_status,new_status,old_method,new_method,reason,created_at")
      .eq("payment_id", r.id)
      .order("created_at", { ascending: false });
    setHistory((data ?? []) as AuditEntry[]);
    setHistoryLoading(false);
  };

  return (
    <LandlordLayout crumbs={["Payment Tracking"]}>
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">Payment tracking</h1>
      <p className="text-muted-foreground mt-1.5 text-sm">All rent payments across your portfolio.</p>

      <div className="flex flex-wrap items-center gap-3 mt-6">
        <div className="relative flex-1 min-w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search tenant or unit" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <Select value={filter} onValueChange={v => setFilter(v as any)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border border-border bg-card mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              <th className="text-left font-medium px-6 py-4">Tenant</th>
              <th className="text-left font-medium px-6 py-4">Unit</th>
              <th className="text-left font-medium px-6 py-4">Due</th>
              <th className="text-left font-medium px-6 py-4">Paid</th>
              <th className="text-left font-medium px-6 py-4">Method</th>
              <th className="text-left font-medium px-6 py-4">Status</th>
              <th className="text-right font-medium px-6 py-4">Amount</th>
              <th className="text-right font-medium px-6 py-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">No payments match these filters.</td></tr>
            ) : filtered.map(r => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-6 py-4 font-medium text-foreground">{r.tenant}</td>
                <td className="px-6 py-4 text-muted-foreground">{r.unit}</td>
                <td className="px-6 py-4 text-muted-foreground">{shortDate(r.due)}</td>
                <td className="px-6 py-4 text-muted-foreground">{r.paid ? shortDate(r.paid) : "—"}</td>
                <td className="px-6 py-4 text-muted-foreground">{r.method ?? "—"}</td>
                <td className="px-6 py-4">
                  <StatusPill tone={r.status === "paid" ? "success" : r.status === "pending" ? "warning" : r.status === "failed" ? "danger" : "muted"}>
                    {r.status[0].toUpperCase() + r.status.slice(1)}
                  </StatusPill>
                </td>
                <td className="px-6 py-4 text-right font-mono font-medium text-foreground">{money(r.amount)}</td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    {r.status === "pending" && (
                      <Button size="sm" variant="outline" onClick={() => openEdit(r)}>Update</Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => openHistory(r)} title="View audit log">
                      <History className="w-4 h-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update payment status</DialogTitle>
            <DialogDescription>
              Manually mark this pending payment. A reason is required and the change will be recorded in the audit log.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                {editing.tenant} · {editing.unit} · {money(editing.amount)} · due {shortDate(editing.due)}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>New status</Label>
                  <Select value={editStatus} onValueChange={v => setEditStatus(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Method</Label>
                  <Select value={editMethod} onValueChange={setEditMethod}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manual</SelectItem>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="check">Check</SelectItem>
                      <SelectItem value="ach">ACH</SelectItem>
                      <SelectItem value="wire">Wire</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Reason <span className="text-destructive">*</span></Label>
                <Textarea
                  value={editReason}
                  onChange={e => setEditReason(e.target.value)}
                  placeholder="e.g. Tenant paid in cash on April 28"
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)} disabled={saving}>Cancel</Button>
            <Button onClick={submitEdit} disabled={saving}>{saving ? "Saving…" : "Save change"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History dialog */}
      <Dialog open={!!historyFor} onOpenChange={o => !o && setHistoryFor(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Payment audit log</DialogTitle>
            <DialogDescription>
              {historyFor && <>{historyFor.tenant} · {historyFor.unit} · due {shortDate(historyFor.due)}</>}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            {historyLoading ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>
            ) : history.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No manual changes recorded.</p>
            ) : (
              <ul className="space-y-3">
                {history.map(h => (
                  <li key={h.id} className="border border-border rounded-lg p-3 text-sm">
                    <div className="flex justify-between items-start gap-3">
                      <div>
                        <span className="text-muted-foreground">Status: </span>
                        <span className="font-medium">{h.old_status ?? "—"} → {h.new_status}</span>
                        {h.old_method !== h.new_method && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            Method: {h.old_method ?? "—"} → {h.new_method ?? "—"}
                          </div>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(h.created_at).toLocaleString()}
                      </span>
                    </div>
                    {h.reason && (
                      <div className="mt-2 text-muted-foreground italic">"{h.reason}"</div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </LandlordLayout>
  );
}
