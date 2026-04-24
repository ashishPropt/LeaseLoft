import { useEffect, useState } from "react";
import { Mail, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LandlordLayout } from "@/components/layout/LandlordLayout";
import { StatusPill } from "@/components/layout/StatusPill";
import { initials, money, shortDate } from "@/lib/format";

interface Tenant {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  unit: string;
  rent: number;
  endDate: string;
  status: string;
}

export default function LandlordTenants() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) return;
      const uid = s.session.user.id;

      const { data: leases } = await supabase
        .from("leases").select("id,tenant_id,unit_id,rent_amount,end_date,status")
        .eq("landlord_id", uid).eq("status", "active");

      const tenantIds = Array.from(new Set((leases ?? []).map(l => l.tenant_id)));
      if (tenantIds.length === 0) { setLoading(false); return; }

      const [{ data: profs }, { data: units }, { data: props }] = await Promise.all([
        supabase.from("profiles").select("id,full_name,first_name,last_name,email,phone_e164").in("id", tenantIds),
        supabase.from("units").select("id,label,property_id"),
        supabase.from("properties").select("id,name"),
      ]);

      const profById = new Map((profs ?? []).map(p => [p.id, p]));
      const unitById = new Map((units ?? []).map(u => [u.id, u]));
      const propById = new Map((props ?? []).map(p => [p.id, p]));

      setTenants((leases ?? []).map(l => {
        const p = profById.get(l.tenant_id);
        const u = unitById.get(l.unit_id);
        const pr = u ? propById.get(u.property_id) : undefined;
        const name = p?.full_name || `${p?.first_name ?? ""} ${p?.last_name ?? ""}`.trim() || p?.email || "Tenant";
        return {
          id: l.id,
          name,
          email: p?.email ?? "",
          phone: p?.phone_e164 ?? null,
          unit: `${pr?.name ?? "—"} · ${u?.label ?? ""}`,
          rent: Number(l.rent_amount),
          endDate: l.end_date,
          status: l.status,
        };
      }));
      setLoading(false);
    })();
  }, []);

  return (
    <LandlordLayout crumbs={["Tenants"]}>
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">Tenants</h1>
      <p className="text-muted-foreground mt-1.5 text-sm">{tenants.length} active tenants across your portfolio.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-6">
        {loading ? (
          <div className="text-muted-foreground">Loading…</div>
        ) : tenants.length === 0 ? (
          <div className="text-muted-foreground">No active tenants yet. Invite one from the Invite Tenants page.</div>
        ) : tenants.map(t => (
          <div key={t.id} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-muted text-foreground grid place-items-center text-sm font-semibold">
                {initials(t.name)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-foreground truncate">{t.name}</div>
                <div className="text-xs text-muted-foreground truncate">{t.unit}</div>
              </div>
              <StatusPill tone="success">Active</StatusPill>
            </div>
            <div className="mt-4 space-y-1.5 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground"><Mail className="w-3.5 h-3.5" /> {t.email}</div>
              {t.phone && <div className="flex items-center gap-2 text-muted-foreground"><Phone className="w-3.5 h-3.5" /> {t.phone}</div>}
            </div>
            <div className="mt-4 pt-4 border-t border-border flex items-center justify-between text-sm">
              <div>
                <div className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Rent</div>
                <div className="font-mono font-semibold text-foreground">{money(t.rent)}/mo</div>
              </div>
              <div className="text-right">
                <div className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Lease ends</div>
                <div className="text-foreground">{shortDate(t.endDate)}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </LandlordLayout>
  );
}
