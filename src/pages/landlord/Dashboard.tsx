import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, DollarSign, Wrench, Plus, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LandlordLayout } from "@/components/layout/LandlordLayout";
import { StatCard } from "@/components/layout/StatCard";
import { StatusPill } from "@/components/layout/StatusPill";
import { Button } from "@/components/ui/button";
import { money, monthDay, shortDate } from "@/lib/format";

interface DashboardData {
  collected: number;
  outstanding: number;
  expected: number;
  occupied: number;
  totalUnits: number;
  paid: number;
  pending: number;
  failed: number;
  attention: Array<{ kind: "payment" | "maintenance"; title: string; meta: string; tone: "danger" | "warning" }>;
  recent: Array<{ id: string; tenant: string; unit: string; date: string; method: string; status: string; amount: number }>;
  propertyName: string;
}

export default function LandlordDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) return;
      const uid = s.session.user.id;

      const [{ data: props }, { data: units }, { data: leases }, { data: payments }, { data: maint }] = await Promise.all([
        supabase.from("properties").select("id,name").eq("owner_id", uid),
        supabase.from("units").select("id,label,property_id,rent_amount"),
        supabase.from("leases").select("id,tenant_id,unit_id,rent_amount,status").eq("landlord_id", uid).eq("status", "active"),
        supabase.from("payments").select("id,lease_id,amount,due_date,paid_at,status,method").order("due_date", { ascending: false }).limit(200),
        supabase.from("maintenance_requests").select("id,title,priority,status,created_at,lease_id").in("status", ["open","in_progress"]).order("created_at", { ascending: false }).limit(5),
      ]);

      const propIds = new Set((props ?? []).map(p => p.id));
      const myUnits = (units ?? []).filter(u => propIds.has(u.property_id));
      const myUnitIds = new Set(myUnits.map(u => u.id));
      const myLeases = (leases ?? []).filter(l => myUnitIds.has(l.unit_id));
      const myLeaseIds = new Set(myLeases.map(l => l.id));
      const myPayments = (payments ?? []).filter(p => myLeaseIds.has(p.lease_id));

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const monthPays = myPayments.filter(p => {
        const d = new Date(p.due_date);
        return d >= monthStart && d < monthEnd;
      });
      const collected = monthPays.filter(p => p.status === "paid").reduce((s, p) => s + Number(p.amount), 0);
      const expected = myLeases.reduce((s, l) => s + Number(l.rent_amount), 0);
      const outstanding = Math.max(0, expected - collected);
      const paid = monthPays.filter(p => p.status === "paid").length;
      const pending = monthPays.filter(p => p.status === "pending").length;
      const failed = monthPays.filter(p => p.status === "failed").length;

      // Tenant names map
      const tenantIds = Array.from(new Set(myLeases.map(l => l.tenant_id)));
      const { data: profs } = tenantIds.length
        ? await supabase.from("profiles").select("id,full_name,first_name,last_name,email").in("id", tenantIds)
        : { data: [] as any[] };
      const tenantById = new Map((profs ?? []).map(p => [p.id, p.full_name || `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || p.email]));

      const unitById = new Map(myUnits.map(u => [u.id, u]));
      const propById = new Map((props ?? []).map(p => [p.id, p]));
      const leaseById = new Map(myLeases.map(l => [l.id, l]));

      const attention: DashboardData["attention"] = [];
      monthPays.filter(p => p.status === "failed" || (p.status === "pending" && new Date(p.due_date) < now)).slice(0, 3).forEach(p => {
        const lease = leaseById.get(p.lease_id);
        const u = lease ? unitById.get(lease.unit_id) : undefined;
        const prop = u ? propById.get(u.property_id) : undefined;
        attention.push({
          kind: "payment",
          title: tenantById.get(lease?.tenant_id ?? "") ?? "Tenant",
          meta: `${prop?.name ?? "—"} · ${u?.label ?? ""} · ${money(p.amount)} past due`,
          tone: "danger",
        });
      });
      (maint ?? []).filter(m => myLeaseIds.has(m.lease_id)).slice(0, 3).forEach(m => {
        attention.push({ kind: "maintenance", title: m.title, meta: `${m.priority} · ${monthDay(m.created_at)}`, tone: "warning" });
      });

      const recent = myPayments.filter(p => p.status === "paid").slice(0, 5).map(p => {
        const lease = leaseById.get(p.lease_id);
        const u = lease ? unitById.get(lease.unit_id) : undefined;
        const prop = u ? propById.get(u.property_id) : undefined;
        return {
          id: p.id,
          tenant: tenantById.get(lease?.tenant_id ?? "") ?? "Tenant",
          unit: `${prop?.name ?? "—"} · ${u?.label ?? ""}`,
          date: shortDate(p.paid_at ?? p.due_date),
          method: p.method ?? "—",
          status: p.status,
          amount: Number(p.amount),
        };
      });

      setData({
        collected,
        outstanding,
        expected,
        occupied: myLeases.length,
        totalUnits: myUnits.length,
        paid,
        pending,
        failed,
        attention,
        recent,
        propertyName: props?.[0]?.name ?? "Your portfolio",
      });
    })();
  }, []);

  if (!data) return <LandlordLayout crumbs={["Dashboard"]}><div className="text-muted-foreground">Loading…</div></LandlordLayout>;

  const pct = data.expected > 0 ? Math.round((data.collected / data.expected) * 100) : 0;

  return (
    <LandlordLayout crumbs={["Dashboard"]}>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Portfolio overview</h1>
          <p className="text-muted-foreground mt-1.5 text-sm">{data.propertyName} · {data.occupied} of {data.totalUnits} units occupied</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline"><Upload className="w-4 h-4 mr-2" />Export rent roll</Button>
          <Button asChild><Link to="/landlord/invite"><Plus className="w-4 h-4 mr-2" />Add tenant</Link></Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mt-8">
        <StatCard label={`Collected (${new Date().toLocaleString("en-US",{month:"long"})})`} value={money(data.collected)} hint={<StatusPill tone="success">{pct}% of expected</StatusPill>} />
        <StatCard label="Outstanding" value={money(data.outstanding)} hint={<span className="text-muted-foreground">{data.failed + data.pending} tenants late</span>} />
        <StatCard label="Monthly expected" value={money(data.expected)} hint={<span className="text-muted-foreground">Across {data.occupied} active leases</span>} />
        <StatCard label="Occupancy" value={`${data.totalUnits > 0 ? Math.round((data.occupied / data.totalUnits) * 100) : 0}%`} hint={<span className="text-muted-foreground">{data.occupied} / {data.totalUnits} units</span>} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Collections — {new Date().toLocaleString("en-US",{month:"long",year:"numeric"})}</h2>
            <Link to="/landlord/payments" className="text-sm text-foreground/70 hover:text-foreground inline-flex items-center gap-1">View all <ArrowUpRight className="w-3.5 h-3.5" /></Link>
          </div>
          <div className="mt-5 flex items-center justify-between text-sm">
            <span className="text-foreground">{money(data.collected)} collected</span>
            <span className="text-muted-foreground">{money(data.outstanding)} remaining</span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-foreground" style={{ width: `${pct}%` }} />
          </div>
          <div className="grid grid-cols-3 gap-4 mt-6">
            {[{label:"Paid",val:data.paid,tone:"text-foreground"},{label:"Pending",val:data.pending,tone:"text-foreground"},{label:"Failed",val:data.failed,tone:"text-destructive"}].map(s => (
              <div key={s.label}>
                <div className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{s.label}</div>
                <div className={`text-2xl font-semibold mt-1 font-mono ${s.tone}`}>{s.val}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="font-semibold text-foreground">Needs attention</h2>
          <div className="mt-4 space-y-3">
            {data.attention.length === 0 ? (
              <div className="text-sm text-muted-foreground">All clear — nothing needs your attention.</div>
            ) : data.attention.map((a, i) => (
              <div key={i} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg border border-border grid place-items-center text-muted-foreground shrink-0">
                    {a.kind === "payment" ? <DollarSign className="w-4 h-4" /> : <Wrench className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{a.title}</div>
                    <div className="text-xs text-muted-foreground truncate">{a.meta}</div>
                  </div>
                </div>
                <StatusPill tone={a.tone}>{a.tone === "danger" ? "Late" : "Open"}</StatusPill>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 mt-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Recent payments</h2>
          <Link to="/landlord/payments" className="text-sm text-foreground/70 hover:text-foreground inline-flex items-center gap-1">View all <ArrowUpRight className="w-3.5 h-3.5" /></Link>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                <th className="text-left font-medium pb-3">Tenant</th>
                <th className="text-left font-medium pb-3">Unit</th>
                <th className="text-left font-medium pb-3">Date</th>
                <th className="text-left font-medium pb-3">Method</th>
                <th className="text-left font-medium pb-3">Status</th>
                <th className="text-right font-medium pb-3">Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.recent.map(r => (
                <tr key={r.id} className="border-t border-border">
                  <td className="py-3 font-medium text-foreground">{r.tenant}</td>
                  <td className="py-3 text-muted-foreground">{r.unit}</td>
                  <td className="py-3 text-muted-foreground">{r.date}</td>
                  <td className="py-3 text-muted-foreground">{r.method}</td>
                  <td className="py-3"><StatusPill tone="success">Completed</StatusPill></td>
                  <td className="py-3 text-right font-mono font-medium text-foreground">{money(r.amount)}</td>
                </tr>
              ))}
              {data.recent.length === 0 && (
                <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">No payments yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </LandlordLayout>
  );
}
