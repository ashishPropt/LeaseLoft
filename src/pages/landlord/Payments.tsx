import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, ArrowRightLeft, Check, Clock, ExternalLink, X } from "lucide-react";
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
  leaseStatus: "active" | "inactive";
  leaseLabel: string;
  due: string;
  paid: string | null;
  amount: number;
  method: string | null;
  status: string;
  transferId: string | null;
  transferStatus: string | null;
  transferError: string | null;
  transferCreatedAt: string | null;
  destinationAccountId: string | null;
  providerTransferId: string | null;
  failureReason: string | null;
  updatedAt: string;
  createdAt: string;
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
  const [tenantFilter, setTenantFilter] = useState<string>("all");
  const [unitFilter, setUnitFilter] = useState<string>("all");
  const [leaseFilter, setLeaseFilter] = useState<string>("all");
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
      .select("id,tenant_id,unit_id,status")
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
      const tenantName = tenantById.get(lease?.tenant_id ?? "") ?? "Tenant";
      const unitLabel = `${prop?.name ?? "—"} · ${unit?.label ?? ""}`;
      return {
        id: p.id,
        tenant: tenantName,
        tenantId: lease?.tenant_id ?? "",
        unit: unitLabel,
        unitId: lease?.unit_id ?? "",
        leaseId: lease?.id ?? "",
        leaseStatus: (lease?.status === "active" ? "active" : "inactive") as "active" | "inactive",
        leaseLabel: `${tenantName} · ${unitLabel}`,
        due: p.due_date,
        paid: p.paid_at,
        amount: Number(p.amount),
        method: p.method,
        status: p.status,
        transferId: p.transfer_id ?? null,
        transferStatus: p.transfer_status ?? null,
        transferError: p.transfer_error ?? null,
        transferCreatedAt: p.transfer_created_at ?? null,
        destinationAccountId: p.destination_account_id ?? null,
        providerTransferId: p.provider_transfer_id ?? null,
        failureReason: p.failure_reason ?? null,
        updatedAt: p.updated_at,
        createdAt: p.created_at,
      };
    }));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const tenantOptions = useMemo(() => {
    const m = new Map<string, string>();
    rows.forEach(r => { if (r.tenantId) m.set(r.tenantId, r.tenant); });
    return Array.from(m, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  const unitOptions = useMemo(() => {
    const m = new Map<string, string>();
    rows.forEach(r => {
      if (!r.unitId) return;
      if (tenantFilter !== "all" && r.tenantId !== tenantFilter) return;
      m.set(r.unitId, r.unit);
    });
    return Array.from(m, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows, tenantFilter]);

  const filtered = useMemo(() => rows.filter(r => {
    if (filter !== "all" && r.status !== filter) return false;
    if (tenantFilter !== "all" && r.tenantId !== tenantFilter) return false;
    if (unitFilter !== "all" && r.unitId !== unitFilter) return false;
    if (leaseFilter !== "all" && r.leaseStatus !== leaseFilter) return false;
    return true;
  }), [rows, filter, tenantFilter, unitFilter, leaseFilter]);

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
        <Select value={tenantFilter} onValueChange={v => { setTenantFilter(v); setUnitFilter("all"); setLeaseFilter("all"); }}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Tenant" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All tenants</SelectItem>
            {tenantOptions.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={unitFilter} onValueChange={v => { setUnitFilter(v); setLeaseFilter("all"); }}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Unit" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All units</SelectItem>
            {unitOptions.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={leaseFilter} onValueChange={setLeaseFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Lease" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All leases</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
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
              <th className="text-left font-medium px-6 py-4">Transfer</th>
              <th className="text-right font-medium px-6 py-4">Amount</th>
              <th className="text-right font-medium px-6 py-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="px-6 py-12 text-center text-muted-foreground">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={9} className="px-6 py-12 text-center text-muted-foreground">No payments match these filters.</td></tr>
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
                <td className="px-6 py-4">
                  <TransferCell row={r} />
                </td>
                <td className="px-6 py-4 text-right font-mono font-medium text-foreground">{money(r.amount)}</td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    {r.status === "pending" && (
                      <Button size="sm" variant="outline" onClick={() => openEdit(r)}>Update</Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => openHistory(r)} title="View timeline">
                      <Activity className="w-4 h-4" />
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

      {/* Timeline dialog */}
      <Dialog open={!!historyFor} onOpenChange={o => !o && setHistoryFor(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Payment timeline</DialogTitle>
            <DialogDescription>
              {historyFor && <>{historyFor.tenant} · {historyFor.unit} · due {shortDate(historyFor.due)} · {money(historyFor.amount)}</>}
            </DialogDescription>
          </DialogHeader>

          {historyFor && (
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs space-y-1">
              <div className="grid grid-cols-[110px_1fr] gap-x-3">
                <span className="text-muted-foreground">Payment status</span>
                <span className="font-medium">{historyFor.status}</span>
                <span className="text-muted-foreground">Transfer</span>
                <span className="font-medium">{transferLabel(historyFor)}</span>
                {historyFor.transferId && (
                  <>
                    <span className="text-muted-foreground">Transfer ID</span>
                    <span className="font-mono break-all">{historyFor.transferId}</span>
                  </>
                )}
                {historyFor.destinationAccountId && (
                  <>
                    <span className="text-muted-foreground">Destination</span>
                    <span className="font-mono break-all">{historyFor.destinationAccountId}</span>
                  </>
                )}
                {historyFor.providerTransferId && (
                  <>
                    <span className="text-muted-foreground">PaymentIntent</span>
                    <span className="font-mono break-all">{historyFor.providerTransferId}</span>
                  </>
                )}
                {historyFor.transferError && (
                  <>
                    <span className="text-muted-foreground">Transfer error</span>
                    <span className="text-destructive">{historyFor.transferError}</span>
                  </>
                )}
                {historyFor.failureReason && (
                  <>
                    <span className="text-muted-foreground">Failure reason</span>
                    <span className="text-destructive">{historyFor.failureReason}</span>
                  </>
                )}
              </div>
            </div>
          )}

          <div className="max-h-96 overflow-y-auto mt-2">
            {historyLoading ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>
            ) : (() => {
              const events = historyFor ? buildTimeline(historyFor, history) : [];
              if (events.length === 0) {
                return <p className="text-sm text-muted-foreground py-6 text-center">No events recorded.</p>;
              }
              return (
                <ol className="relative border-l border-border ml-3 space-y-4 pl-5 py-2">
                  {events.map((e, i) => (
                    <li key={i} className="relative">
                      <span className={`absolute -left-[26px] top-0.5 grid place-items-center w-5 h-5 rounded-full border ${e.iconBg}`}>
                        <e.Icon className="w-3 h-3" />
                      </span>
                      <div className="text-sm font-medium text-foreground">{e.title}</div>
                      {e.detail && <div className="text-xs text-muted-foreground mt-0.5">{e.detail}</div>}
                      <div className="text-[11px] text-muted-foreground mt-0.5">{new Date(e.at).toLocaleString()}</div>
                    </li>
                  ))}
                </ol>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>
    </LandlordLayout>
  );
}

function transferLabel(r: Row): string {
  if (r.transferId) return `created (${r.transferId.slice(0, 14)}…)`;
  if (r.transferStatus) return r.transferStatus;
  if (r.status === "paid") return "not transferred";
  return "—";
}

function TransferCell({ row }: { row: Row }) {
  if (row.transferId) {
    return (
      <div className="flex items-center gap-1.5 text-xs">
        <Check className="w-3.5 h-3.5 text-emerald-600" />
        <span className="font-mono text-foreground" title={row.transferId}>{row.transferId.slice(0, 10)}…</span>
      </div>
    );
  }
  if (row.transferStatus === "pending_landlord") {
    return (
      <div className="flex items-center gap-1.5 text-xs text-amber-600" title={row.transferError ?? ""}>
        <AlertTriangle className="w-3.5 h-3.5" />
        <span>Landlord not connected</span>
      </div>
    );
  }
  if (row.transferStatus === "failed") {
    return (
      <div className="flex items-center gap-1.5 text-xs text-destructive" title={row.transferError ?? ""}>
        <X className="w-3.5 h-3.5" />
        <span>Failed</span>
      </div>
    );
  }
  if (row.status === "paid") {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Clock className="w-3.5 h-3.5" />
        <span>Pending</span>
      </div>
    );
  }
  return <span className="text-xs text-muted-foreground">—</span>;
}

interface TimelineEvent {
  at: string;
  title: string;
  detail?: string;
  Icon: typeof Check;
  iconBg: string;
}

function buildTimeline(r: Row, audit: AuditEntry[]): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  events.push({
    at: r.createdAt,
    title: "Payment scheduled",
    detail: `Due ${shortDate(r.due)} · ${money(r.amount)}`,
    Icon: Clock,
    iconBg: "bg-muted text-muted-foreground border-border",
  });

  if (r.paid) {
    events.push({
      at: r.paid,
      title: "Marked paid",
      detail: r.method ? `Method: ${r.method}` : undefined,
      Icon: Check,
      iconBg: "bg-emerald-100 text-emerald-700 border-emerald-200",
    });
  } else if (r.status === "failed") {
    events.push({
      at: r.updatedAt,
      title: "Payment failed",
      detail: r.failureReason ?? undefined,
      Icon: X,
      iconBg: "bg-destructive/10 text-destructive border-destructive/30",
    });
  }

  // Audit log entries
  audit.forEach(h => {
    events.push({
      at: h.created_at,
      title: `Status changed: ${h.old_status ?? "—"} → ${h.new_status}`,
      detail: [
        h.old_method !== h.new_method ? `Method: ${h.old_method ?? "—"} → ${h.new_method ?? "—"}` : null,
        h.reason ? `"${h.reason}"` : null,
      ].filter(Boolean).join(" · "),
      Icon: Activity,
      iconBg: "bg-muted text-muted-foreground border-border",
    });
  });

  // Transfer events
  if (r.transferStatus === "pending_landlord") {
    events.push({
      at: r.updatedAt,
      title: "Transfer pending",
      detail: r.transferError ?? "Landlord has not connected a Stripe account.",
      Icon: AlertTriangle,
      iconBg: "bg-amber-100 text-amber-700 border-amber-200",
    });
  }
  if (r.transferStatus === "failed") {
    events.push({
      at: r.updatedAt,
      title: "Transfer failed",
      detail: r.transferError ?? undefined,
      Icon: X,
      iconBg: "bg-destructive/10 text-destructive border-destructive/30",
    });
  }
  if (r.transferId) {
    events.push({
      at: r.transferCreatedAt ?? r.updatedAt,
      title: "Transferred to landlord",
      detail: `Transfer ${r.transferId}${r.destinationAccountId ? ` → ${r.destinationAccountId}` : ""}`,
      Icon: ArrowRightLeft,
      iconBg: "bg-emerald-100 text-emerald-700 border-emerald-200",
    });
  }

  return events.sort((a, b) => +new Date(a.at) - +new Date(b.at));
}

