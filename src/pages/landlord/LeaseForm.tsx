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
  const { slug } = useParams<{ slug: string }>();
  const isEdit = Boolean(slug);
  const [editingId, setEditingId] = useState<string>("");
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uid, setUid] = useState<string>("");

  const [units, setUnits] = useState<UnitOpt[]>([]);
  const [properties, setProperties] = useState<PropOpt[]>([]);
  const [tenants, setTenants] = useState<TenantOpt[]>([]);

  const [propertyId, setPropertyId] = useState<string>("");
  const [unitId, setUnitId] = useState<string>(params.get("unit_id") ?? "");
  const [tenantId, setTenantId] = useState<string>(params.get("tenant_id") ?? "");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [rent, setRent] = useState<string>("");
  const [lateFeeAmount, setLateFeeAmount] = useState<string>("0");
  const [lateFeeGraceDays, setLateFeeGraceDays] = useState<string>("0");
  const [status, setStatus] = useState<"draft" | "active" | "ended" | "terminated">("active");

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) { navigate("/signin"); return; }
      const userId = s.session.user.id;
      setUid(userId);

      const { data: props } = await supabase.from("properties").select("id,name").eq("owner_id", userId);
      const propsList = (props ?? []) as PropOpt[];
      setProperties(propsList);
      const propIds = propsList.map(p => p.id);

      let unitsList: UnitOpt[] = [];
      if (propIds.length) {
        const { data: u } = await supabase.from("units").select("id,label,property_id,rent_amount").in("property_id", propIds);
        unitsList = (u ?? []) as UnitOpt[];
        setUnits(unitsList);
      }

      // Build tenant pool:
      //  - tenants who redeemed an invite this landlord created (=> active account)
      //  - plus tenants already associated with any of this landlord's leases
      // Then exclude any tenant who currently has an ACTIVE lease under this landlord.
      const [{ data: redeemed }, { data: existing }] = await Promise.all([
        supabase.from("invite_codes").select("used_by").eq("created_by", userId).eq("role", "tenant").not("used_by", "is", null),
        supabase.from("leases").select("tenant_id,status").eq("landlord_id", userId),
      ]);

      const activeTenantIds = new Set((existing ?? []).filter(l => l.status === "active").map(l => l.tenant_id));
      const candidateIds = new Set<string>();
      (redeemed ?? []).forEach((r: any) => r.used_by && candidateIds.add(r.used_by));
      (existing ?? []).forEach(l => candidateIds.add(l.tenant_id));

      // Exclude tenants who already have an active lease (the user only wants tenants without active leases).
      // But always keep the currently-edited lease's tenant available.
      let editingTenantId: string | null = null;
      if (isEdit && slug) {
        const { data: leaseRow } = await supabase.from("leases").select("id,tenant_id").eq("public_slug", slug).maybeSingle();
        editingTenantId = leaseRow?.tenant_id ?? null;
        if (leaseRow?.id) setEditingId(leaseRow.id);
        if (editingTenantId) candidateIds.add(editingTenantId);
      }

      const eligibleIds = Array.from(candidateIds).filter(tid => tid === editingTenantId || !activeTenantIds.has(tid));

      if (eligibleIds.length) {
        const { data: profs } = await supabase.from("profiles").select("id,full_name,first_name,last_name,email").in("id", eligibleIds);
        setTenants(((profs ?? []) as any[]).map(p => ({
          id: p.id,
          email: p.email,
          name: p.full_name || `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || p.email,
        })).sort((a, b) => a.name.localeCompare(b.name)));
      } else {
        setTenants([]);
      }

      if (isEdit && slug) {
        const { data: lease } = await supabase.from("leases").select("*").eq("public_slug", slug).maybeSingle();
        if (lease) {
          setEditingId(lease.id);
          setUnitId(lease.unit_id);
          setTenantId(lease.tenant_id);
          setStartDate(lease.start_date);
          setEndDate(lease.end_date);
          setRent(String(lease.rent_amount));
          setLateFeeAmount(String((lease as any).late_fee_amount ?? 0));
          setLateFeeGraceDays(String((lease as any).late_fee_grace_days ?? 0));
          setStatus(lease.status);
          const u = unitsList.find(x => x.id === lease.unit_id);
          if (u) setPropertyId(u.property_id);
        }
      } else {
        // Prefill property from unit_id query param
        const preUnit = params.get("unit_id");
        if (preUnit) {
          const u = unitsList.find(x => x.id === preUnit);
          if (u) setPropertyId(u.property_id);
        }
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, isEdit]);

  const filteredUnits = useMemo(
    () => (propertyId ? units.filter(u => u.property_id === propertyId) : []),
    [units, propertyId]
  );

  function onPropertyChange(v: string) {
    setPropertyId(v);
    // Clear unit if it doesn't belong to the new property
    const stillValid = units.some(u => u.id === unitId && u.property_id === v);
    if (!stillValid) setUnitId("");
  }

  function onUnitChange(v: string) {
    setUnitId(v);
    // Auto-fill rent from market rent if blank
    if (!rent) {
      const u = units.find(x => x.id === v);
      if (u?.rent_amount != null) setRent(String(u.rent_amount));
    }
  }

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

    const res = isEdit && editingId
      ? await supabase.from("leases").update(payload).eq("id", editingId).select("public_slug").maybeSingle()
      : await supabase.from("leases").insert(payload).select("public_slug").maybeSingle();

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
    navigate(`/landlord/leases/${res.data?.public_slug ?? slug}`);
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
          <div>
            <Label htmlFor="property">Property</Label>
            <Select value={propertyId} onValueChange={onPropertyChange} disabled={isEdit}>
              <SelectTrigger id="property" className="mt-1.5">
                <SelectValue placeholder={properties.length ? "Select a property" : "No properties yet"} />
              </SelectTrigger>
              <SelectContent>
                {properties.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {properties.length === 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                <Link to="/landlord/properties" className="text-primary hover:underline">Add a property</Link> first.
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="unit">Unit</Label>
            <Select value={unitId} onValueChange={onUnitChange} disabled={isEdit || !propertyId}>
              <SelectTrigger id="unit" className="mt-1.5">
                <SelectValue placeholder={!propertyId ? "Select a property first" : filteredUnits.length ? "Select a unit" : "No units in this property"} />
              </SelectTrigger>
              <SelectContent>
                {filteredUnits.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isEdit && <p className="mt-1 text-xs text-muted-foreground">Unit can't be changed on an existing lease.</p>}
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="tenant">Tenant</Label>
            <Select value={tenantId} onValueChange={setTenantId}>
              <SelectTrigger id="tenant" className="mt-1.5">
                <SelectValue placeholder={tenants.length ? "Select a tenant" : "No tenants yet"} />
              </SelectTrigger>
              <SelectContent>
                {tenants.length === 0 ? (
                  <div className="px-2 py-2 text-sm text-muted-foreground">No tenants yet. Invite one first.</div>
                ) : tenants.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.name} · {t.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">
              Shows your tenants with an active account who don't currently have an active lease. Need a new one?{" "}
              <Link to="/landlord/invite" className="text-primary hover:underline">Invite tenant</Link>.
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
