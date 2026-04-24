import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LandlordLayout } from "@/components/layout/LandlordLayout";
import { StatusPill } from "@/components/layout/StatusPill";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { money, shortDate } from "@/lib/format";

interface Row {
  id: string;
  tenant: string;
  unit: string;
  due: string;
  paid: string | null;
  amount: number;
  method: string | null;
  status: string;
}

export default function LandlordPayments() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "paid" | "pending" | "failed">("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
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
        supabase.from("payments").select("*").in("lease_id", leaseIds).order("due_date", { ascending: false }),
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
    })();
  }, []);

  const filtered = useMemo(() => rows.filter(r => {
    if (filter !== "all" && r.status !== filter) return false;
    if (q && !`${r.tenant} ${r.unit}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [rows, q, filter]);

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
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">No payments match these filters.</td></tr>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </LandlordLayout>
  );
}
