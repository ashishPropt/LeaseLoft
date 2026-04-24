import { useEffect, useState } from "react";
import { Building2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { StatusPill } from "@/components/layout/StatusPill";
import { StatCard } from "@/components/layout/StatCard";
import { Input } from "@/components/ui/input";
import { money } from "@/lib/format";

interface Row {
  id: string;
  name: string;
  address: string;
  owner: string;
  unitCount: number;
  occupied: number;
  expected: number;
}

export default function AdminProperties() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const [{ data: props }, { data: units }, { data: leases }, { data: profs }] = await Promise.all([
        supabase.from("properties").select("id,name,address,city,state,owner_id"),
        supabase.from("units").select("id,property_id"),
        supabase.from("leases").select("id,unit_id,rent_amount,status").eq("status", "active"),
        supabase.from("profiles").select("id,full_name,first_name,last_name,email"),
      ]);
      const ownerById = new Map((profs ?? []).map((p: any) => [p.id, p.full_name || `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || p.email]));
      const unitsByProp = new Map<string, string[]>();
      (units ?? []).forEach((u: any) => {
        const arr = unitsByProp.get(u.property_id) ?? [];
        arr.push(u.id);
        unitsByProp.set(u.property_id, arr);
      });
      const leaseByUnit = new Map((leases ?? []).map((l: any) => [l.unit_id, l]));
      setRows((props ?? []).map((p: any) => {
        const unitIds = unitsByProp.get(p.id) ?? [];
        const occ = unitIds.filter(id => leaseByUnit.has(id));
        const expected = occ.reduce((s, id) => s + Number(leaseByUnit.get(id)?.rent_amount ?? 0), 0);
        return {
          id: p.id,
          name: p.name,
          address: [p.address, p.city, p.state].filter(Boolean).join(", "),
          owner: ownerById.get(p.owner_id) ?? "—",
          unitCount: unitIds.length,
          occupied: occ.length,
          expected,
        };
      }));
      setLoading(false);
    })();
  }, []);

  const filtered = rows.filter(r => !q || `${r.name} ${r.address} ${r.owner}`.toLowerCase().includes(q.toLowerCase()));
  const totalUnits = rows.reduce((s, r) => s + r.unitCount, 0);
  const totalOccupied = rows.reduce((s, r) => s + r.occupied, 0);
  const totalExpected = rows.reduce((s, r) => s + r.expected, 0);

  return (
    <AdminLayout crumbs={["Properties"]}>
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">All properties</h1>
      <p className="text-muted-foreground mt-1.5 text-sm">Read-only directory of every property in the system.</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <StatCard label="Properties" value={String(rows.length)} hint={<span className="text-muted-foreground">{totalUnits} units total</span>} />
        <StatCard label="Occupancy" value={`${totalUnits > 0 ? Math.round((totalOccupied / totalUnits) * 100) : 0}%`} hint={<span className="text-muted-foreground">{totalOccupied} / {totalUnits} occupied</span>} />
        <StatCard label="Monthly expected" value={money(totalExpected)} hint={<span className="text-muted-foreground">Active leases</span>} />
      </div>

      <div className="relative mt-6 max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search property, owner or city" value={q} onChange={e => setQ(e.target.value)} />
      </div>

      <div className="rounded-xl border border-border bg-card mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              <th className="text-left font-medium px-6 py-4">Property</th>
              <th className="text-left font-medium px-6 py-4">Address</th>
              <th className="text-left font-medium px-6 py-4">Owner</th>
              <th className="text-left font-medium px-6 py-4">Units</th>
              <th className="text-left font-medium px-6 py-4">Occupancy</th>
              <th className="text-right font-medium px-6 py-4">Monthly</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-16 text-center text-muted-foreground"><Building2 className="w-8 h-8 mx-auto mb-2 opacity-40" />No properties yet.</td></tr>
            ) : filtered.map(r => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-6 py-4 font-medium text-foreground">{r.name}</td>
                <td className="px-6 py-4 text-muted-foreground">{r.address || "—"}</td>
                <td className="px-6 py-4 text-muted-foreground">{r.owner}</td>
                <td className="px-6 py-4 text-muted-foreground">{r.unitCount}</td>
                <td className="px-6 py-4">
                  <StatusPill tone={r.occupied === r.unitCount && r.unitCount > 0 ? "success" : r.occupied === 0 ? "muted" : "warning"}>
                    {r.occupied} / {r.unitCount}
                  </StatusPill>
                </td>
                <td className="px-6 py-4 text-right font-mono font-medium text-foreground">{money(r.expected)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}
