import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TenantContext {
  userId: string;
  email: string;
  name: string;
  lease: {
    id: string;
    landlord_id: string;
    unit_id: string;
    rent_amount: number;
    start_date: string;
    end_date: string;
    status: string;
  } | null;
  unit: { id: string; label: string; bedrooms: number | null; bathrooms: number | null } | null;
  property: { id: string; name: string; address: string | null; city: string | null; state: string | null; zip: string | null } | null;
  landlordName: string | null;
}

export function useTenantContext() {
  const [ctx, setCtx] = useState<TenantContext | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) { setLoading(false); return; }
      const uid = s.session.user.id;

      const { data: prof } = await supabase
        .from("profiles")
        .select("first_name,last_name,full_name,email")
        .eq("id", uid).maybeSingle();
      const name = prof?.full_name?.trim() || `${prof?.first_name ?? ""} ${prof?.last_name ?? ""}`.trim() || prof?.email || "Tenant";
      const email = prof?.email ?? s.session.user.email ?? "";

      const { data: leases } = await supabase
        .from("leases")
        .select("id,landlord_id,unit_id,rent_amount,start_date,end_date,status")
        .eq("tenant_id", uid)
        .order("start_date", { ascending: false });
      const active = leases?.find(l => l.status === "active") ?? leases?.[0] ?? null;

      let unit = null as TenantContext["unit"];
      let property = null as TenantContext["property"];
      let landlordName: string | null = null;
      if (active) {
        const { data: u } = await supabase.from("units").select("id,label,bedrooms,bathrooms,property_id").eq("id", active.unit_id).maybeSingle();
        if (u) {
          unit = { id: u.id, label: u.label, bedrooms: u.bedrooms, bathrooms: u.bathrooms };
          const { data: p } = await supabase.from("properties").select("id,name,address,city,state,zip").eq("id", u.property_id).maybeSingle();
          property = p ?? null;
        }
        const { data: ll } = await supabase.from("profiles").select("full_name,first_name,last_name,email").eq("id", active.landlord_id).maybeSingle();
        if (ll) landlordName = ll.full_name || `${ll.first_name ?? ""} ${ll.last_name ?? ""}`.trim() || ll.email;
      }

      setCtx({
        userId: uid,
        email,
        name,
        lease: active ? {
          id: active.id, landlord_id: active.landlord_id, unit_id: active.unit_id,
          rent_amount: Number(active.rent_amount), start_date: active.start_date,
          end_date: active.end_date, status: active.status,
        } : null,
        unit, property, landlordName,
      });
      setLoading(false);
    })();
  }, []);

  return { ctx, loading };
}
