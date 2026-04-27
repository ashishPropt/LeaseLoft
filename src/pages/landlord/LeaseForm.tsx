import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LandlordLayout } from "@/components/layout/LandlordLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface UnitOpt { id: string; label: string; property_id: string; rent_amount: number | null; }
interface PropOpt { id: string; name: string; }
interface TenantOpt { id: string; name: string; email: string; }

export default function LandlordLeaseForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uid, setUid] = useState<string>("");

  const [units, setUnits] = useState<UnitOpt[]>([]);
  const [properties, setProperties] = useState<PropOpt[]>([]);
  const [tenants, setTenants] = useState<TenantOpt[]>([]);

  const [unitId, setUnitId] = useState<string>(params.get("unit_id") ?? "");
  const [tenantId, setTenantId] = useState<string>(params.get("tenant_id") ?? "");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [rent, setRent] = useState<string>("");
  const [status, setStatus] = useState<"draft" | "active" | "ended" | "terminated">("active");

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) { navigate("/signin"); return; }
      const userId = s.session.user.id;
      setUid(userId);

      const { data: props } = await supabase.from("properties").select("id,name").eq("owner_id", userId);
      setProperties((props ?? []) as PropOpt[]);
      const propIds = (props ?? []).map(p => p.id);

      if (propIds.length) {
        const { data: u } = await supabase.from("units").select("id,label,property_id,rent_amount").in("property_id", propIds);
        setUnits((u ?? []) as UnitOpt[]);
      }

      // Tenants = anyone with a lease under this landlord (existing tenants pool)
      const { data: existing } = await supabase.from("leases").select("tenant_id").eq("landlord_id", userId);
      const tenantIds = Array.from(new Set((existing ?? []).map(l => l.tenant_id)));
      if (tenantIds.length) {
        const { data: profs } = await supabase.from("profiles").select("id,full_name,first_name,last_name,email").in("id", tenantIds);
        setTenants(((profs ?? []) as any[]).map(p => ({
          id: p.id,
          email: p.email,
          name: p.full_name || `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || p.email,
        })));
      }

      if (isEdit && id) {
        const { data: lease } = await supabase.from("leases").select("*").eq("id", id).maybeSingle();
        if (lease) {
          setUnitId(lease.unit_id);
          setTenantId(lease.tenant_id);
          setStartDate(lease.start_date);
          setEndDate(lease.end_date);
          setRent(String(lease.rent_amount));
          setStatus(lease.status);
        }
      }
      setLoading(false);
    })();
  }, [id, isEdit, navigate]);

  const unitsByProp = useMemo(() => {
    const m = new Map<string, UnitOpt[]>();
    for (const u of units) {
      const arr = m.get(u.property_id) ?? [];
      arr.push(u); m.set(u.property_id, arr);
    }
    return m;
  }, [units]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!unitId || !tenantId || !startDate || !endDate || !rent) {
      toast.error("Please fill in all fields.");
      return;
    }
    if (new Date(endDate) <= new Date(startDate)) {
      toast.error("End date must be after start date.");
      return;
    }
    setSaving(true);
    const payload = {
      unit_id: unitId,
      tenant_id: tenantId,
      landlord_id: uid,
      start_date: startDate,
      end_date: endDate,
      rent_amount: Number(rent),
      status,
    };

    const res = isEdit && id
      ? await supabase.from("leases").update(payload).eq("id", id).select("id").maybeSingle()
      : await supabase.from("leases").insert(payload).select("id").maybeSingle();

    setSaving(false);
    if (res.error) {
      toast.error(
        res.error.message.includes("leases_one_active_per_unit")
          ? "This unit already has an active lease. End it before creating a new active one."
          : res.error.message
      );
      return;
    }
    toast.success(isEdit ? "Lease updated" : "Lease created");
    navigate(`/landlord/leases/${res.data?.id ?? id}`);
  }

  if (loading) {
    return <LandlordLayout crumbs={["Leases", isEdit ? "Edit" : "New"]}><div className="text-muted-foreground">Loading…</div></LandlordLayout>;
  }

  return (
    <LandlordLayout crumbs={["Leases", isEdit ? "Edit" : "New"]}>
      <Button variant="ghost" size="sm" className="-ml-3 mb-3" onClick={() => navigate(-1)}>
        <ArrowLeft className="w-4 h-4 mr-1" /> Back
      </Button>
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">
        {isEdit ? "Edit lease" : "New lease"}
      </h1>
      <p className="text-muted-foreground mt-1.5 text-sm">
        {isEdit ? "Update the terms of this lease." : "Create a lease tied to a unit and a tenant."}
      </p>

      <form onSubmit={onSubmit} className="mt-8 max-w-2xl space-y-5 rounded-xl border border-border bg-card p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Label htmlFor="unit">Unit</Label>
            <Select value={unitId} onValueChange={setUnitId} disabled={isEdit}>
              <SelectTrigger id="unit" className="mt-1.5"><SelectValue placeholder="Select a unit" /></SelectTrigger>
              <SelectContent>
                {properties.map(p => (
                  <div key={p.id}>
                    <div className="px-2 py-1 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{p.name}</div>
                    {(unitsByProp.get(p.id) ?? []).map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.label}</SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
            {isEdit && <p className="mt-1 text-xs text-muted-foreground">Unit can't be changed on an existing lease.</p>}
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="tenant">Tenant</Label>
            <Select value={tenantId} onValueChange={setTenantId}>
              <SelectTrigger id="tenant" className="mt-1.5"><SelectValue placeholder="Select a tenant" /></SelectTrigger>
              <SelectContent>
                {tenants.length === 0 ? (
                  <div className="px-2 py-2 text-sm text-muted-foreground">No tenants yet. Invite one first.</div>
                ) : tenants.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.name} · {t.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">
              Need a new tenant? <Link to="/landlord/invite" className="text-primary hover:underline">Invite tenant</Link>.
            </p>
          </div>

          <div>
            <Label htmlFor="start">Start date</Label>
            <Input id="start" type="date" className="mt-1.5" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="end">End date</Label>
            <Input id="end" type="date" className="mt-1.5" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="rent">Monthly rent</Label>
            <Input id="rent" type="number" min="0" step="0.01" className="mt-1.5" value={rent} onChange={e => setRent(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={(v: any) => setStatus(v)}>
              <SelectTrigger id="status" className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="ended">Ended</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : isEdit ? "Save changes" : "Create lease"}</Button>
          <Button type="button" variant="ghost" onClick={() => navigate(-1)}>Cancel</Button>
        </div>
      </form>
    </LandlordLayout>
  );
}
