import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LandlordLayout } from "@/components/layout/LandlordLayout";
import { StatusPill } from "@/components/layout/StatusPill";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/format";

interface Row {
  unitId: string;
  property: string;
  unit: string;
  beds: number | null;
  baths: number | null;
  marketRent: number;
  tenant: string | null;
  leaseRent: number | null;
  leaseId: string | null;
  status: "occupied" | "vacant";
}

export default function LandlordRentRoll() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) return;
      const uid = s.session.user.id;

      const { data: props } = await supabase.from("properties").select("id,name").eq("owner_id", uid);
      const propIds = (props ?? []).map(p => p.id);
      if (propIds.length === 0) { setLoading(false); return; }

      const [{ data: units }, { data: leases }] = await Promise.all([
        supabase.from("units").select("id,label,property_id,bedrooms,bathrooms,rent_amount").in("property_id", propIds),
        supabase.from("leases").select("id,unit_id,tenant_id,rent_amount,status").eq("landlord_id", uid).eq("status", "active"),
      ]);

      const tenantIds = Array.from(new Set((leases ?? []).map(l => l.tenant_id)));
      const { data: profs } = tenantIds.length
        ? await supabase.from("profiles").select("id,full_name,first_name,last_name,email").in("id", tenantIds)
        : { data: [] as any[] };

      const propById = new Map((props ?? []).map(p => [p.id, p]));
      const tenantById = new Map((profs ?? []).map(p => [p.id, p.full_name || `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || p.email]));
      const leaseByUnit = new Map((leases ?? []).map(l => [l.unit_id, l]));

      setRows((units ?? []).map(u => {
        const lease = leaseByUnit.get(u.id);
        const prop = propById.get(u.property_id);
        return {
          unitId: u.id,
          property: prop?.name ?? "—",
          unit: u.label,
          beds: u.bedrooms,
          baths: u.bathrooms,
          marketRent: Number(u.rent_amount ?? 0),
          tenant: lease ? (tenantById.get(lease.tenant_id) ?? "Tenant") : null,
          leaseRent: lease ? Number(lease.rent_amount) : null,
          leaseId: lease ? lease.id : null,
          status: (lease ? "occupied" : "vacant") as "occupied" | "vacant",
        };
      }).sort((a, b) => a.property.localeCompare(b.property) || a.unit.localeCompare(b.unit)));
      setLoading(false);
    })();
  }, []);

  function exportCsv() {
    const header = ["Property","Unit","Beds","Baths","Tenant","Status","Rent"].join(",");
    const lines = rows.map(r => [r.property,r.unit,r.beds ?? "",r.baths ?? "",r.tenant ?? "",r.status,r.leaseRent ?? r.marketRent].join(","));
    const csv = [header, ...lines].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = `rent-roll-${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const totalExpected = rows.reduce((s, r) => s + (r.leaseRent ?? 0), 0);
  const occupied = rows.filter(r => r.status === "occupied").length;

  return (
    <LandlordLayout crumbs={["Rent Roll"]}>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Rent roll</h1>
          <p className="text-muted-foreground mt-1.5 text-sm">{occupied} of {rows.length} units occupied · {money(totalExpected)} monthly</p>
        </div>
        <Button variant="outline" onClick={exportCsv}><Upload className="w-4 h-4 mr-2" />Export CSV</Button>
      </div>

      <div className="rounded-xl border border-border bg-card mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              <th className="text-left font-medium px-6 py-4">Property</th>
              <th className="text-left font-medium px-6 py-4">Unit</th>
              <th className="text-left font-medium px-6 py-4">Beds / Baths</th>
              <th className="text-left font-medium px-6 py-4">Tenant</th>
              <th className="text-left font-medium px-6 py-4">Status</th>
              <th className="text-right font-medium px-6 py-4">Rent</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">No units yet.</td></tr>
            ) : rows.map(r => (
              <tr key={r.unitId} className="border-t border-border">
                <td className="px-6 py-4 font-medium text-foreground">{r.property}</td>
                <td className="px-6 py-4 text-muted-foreground">{r.unit}</td>
                <td className="px-6 py-4 text-muted-foreground">{r.beds ?? "—"} / {r.baths ?? "—"}</td>
                <td className="px-6 py-4 text-muted-foreground">{r.tenant ?? "—"}</td>
                <td className="px-6 py-4">
                  <StatusPill tone={r.status === "occupied" ? "success" : "muted"}>
                    {r.status === "occupied" ? "Occupied" : "Vacant"}
                  </StatusPill>
                </td>
                <td className="px-6 py-4 text-right font-mono font-medium text-foreground">
                  {money(r.leaseRent ?? r.marketRent)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </LandlordLayout>
  );
}
