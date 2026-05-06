import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, FileText, User, Home, Calendar, DollarSign, Pencil, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LandlordLayout } from "@/components/layout/LandlordLayout";
import { StatusPill } from "@/components/layout/StatusPill";
import { Button } from "@/components/ui/button";
import { money, shortDate } from "@/lib/format";
import { toast } from "sonner";
import { LeaseDocuments } from "@/components/documents/LeaseDocuments";

interface LeaseRow {
  id: string;
  public_slug: string;
  unit_id: string;
  tenant_id: string;
  landlord_id: string;
  start_date: string;
  end_date: string;
  rent_amount: number;
  status: string;
  created_at: string;
}

interface UnitRow { id: string; label: string; bedrooms: number | null; bathrooms: number | null; property_id: string; }
interface PropertyRow { id: string; name: string; address: string | null; city: string | null; state: string | null; zip: string | null; }
interface ProfileRow { id: string; full_name: string | null; first_name: string | null; last_name: string | null; email: string; phone_e164: string | null; }
interface PaymentRow { id: string; amount: number; due_date: string; paid_at: string | null; status: string; method: string | null; }

export default function LandlordLeaseDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [lease, setLease] = useState<LeaseRow | null>(null);
  const [unit, setUnit] = useState<UnitRow | null>(null);
  const [property, setProperty] = useState<PropertyRow | null>(null);
  const [tenant, setTenant] = useState<ProfileRow | null>(null);
  const [otherLeases, setOtherLeases] = useState<LeaseRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      setLoading(true);
      const { data: l } = await supabase.from("leases").select("*").eq("public_slug", slug).maybeSingle();
      if (!l) { setLoading(false); return; }
      setLease(l as LeaseRow);

      const [{ data: u }, { data: t }, { data: history }, { data: pays }] = await Promise.all([
        supabase.from("units").select("id,label,bedrooms,bathrooms,property_id").eq("id", l.unit_id).maybeSingle(),
        supabase.from("profiles").select("id,full_name,first_name,last_name,email,phone_e164").eq("id", l.tenant_id).maybeSingle(),
        supabase.from("leases").select("*").eq("unit_id", l.unit_id).order("start_date", { ascending: false }),
        supabase.from("payments").select("id,amount,due_date,paid_at,status,method").eq("lease_id", l.id).order("due_date", { ascending: false }),
      ]);
      setUnit(u as UnitRow | null);
      setTenant(t as ProfileRow | null);
      setOtherLeases(((history ?? []) as LeaseRow[]).filter(x => x.id !== l.id));
      setPayments((pays ?? []) as PaymentRow[]);

      if (u?.property_id) {
        const { data: p } = await supabase.from("properties").select("id,name,address,city,state,zip").eq("id", u.property_id).maybeSingle();
        setProperty(p as PropertyRow | null);
      }
      setLoading(false);
    })();
  }, [slug]);

  async function setStatus(next: "active" | "ended" | "draft") {
    if (!lease) return;
    const { error } = await supabase.from("leases").update({ status: next }).eq("id", lease.id);
    if (error) {
      toast.error(error.message.includes("leases_one_active_per_unit")
        ? "Another active lease already exists for this unit."
        : error.message);
      return;
    }
    setLease({ ...lease, status: next });
    toast.success(`Lease marked as ${next}`);
  }

  if (loading) {
    return <LandlordLayout crumbs={["Leases", "Detail"]}><div className="text-muted-foreground">Loading…</div></LandlordLayout>;
  }
  if (!lease) {
    return (
      <LandlordLayout crumbs={["Leases", "Not found"]}>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Lease not found</h1>
        <p className="text-muted-foreground mt-2">It may have been removed or you may not have access.</p>
        <Button className="mt-6" variant="outline" onClick={() => navigate("/landlord/rent-roll")}><ArrowLeft className="w-4 h-4 mr-2" />Back to rent roll</Button>
      </LandlordLayout>
    );
  }

  const tenantName = tenant?.full_name || `${tenant?.first_name ?? ""} ${tenant?.last_name ?? ""}`.trim() || tenant?.email || "—";
  const months = Math.max(1, Math.round((+new Date(lease.end_date) - +new Date(lease.start_date)) / (1000 * 60 * 60 * 24 * 30)));
  const tone: any = lease.status === "active" ? "success" : lease.status === "ended" ? "muted" : "warning";

  return (
    <LandlordLayout crumbs={["Rent Roll", "Lease"]}>
      <Button variant="ghost" size="sm" className="-ml-3 mb-3" onClick={() => navigate("/landlord/rent-roll")}>
        <ArrowLeft className="w-4 h-4 mr-1" /> Back
      </Button>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Lease details</h1>
          <p className="text-muted-foreground mt-1.5 text-sm">{property?.name ?? "—"} · {unit?.label ?? "—"} · {tenantName}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <StatusPill tone={tone}>{lease.status[0].toUpperCase() + lease.status.slice(1)}</StatusPill>
          <Button size="sm" variant="outline" onClick={() => navigate(`/landlord/leases/${lease.public_slug}/edit`)}>
            <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate(`/landlord/leases/new?unit_id=${lease.unit_id}&tenant_id=${lease.tenant_id}`)}>
            <Plus className="w-3.5 h-3.5 mr-1.5" /> New lease
          </Button>
          {lease.status !== "active" && (
            <Button size="sm" onClick={() => setStatus("active")}>Mark active</Button>
          )}
          {lease.status === "active" && (
            <Button size="sm" variant="outline" onClick={() => setStatus("ended")}>End lease</Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-8">
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-2 text-foreground"><FileText className="w-4 h-4" /><h2 className="font-semibold">Terms</h2></div>
            <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <div>
                <dt className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Start date</dt>
                <dd className="mt-1 text-foreground">{shortDate(lease.start_date)}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">End date</dt>
                <dd className="mt-1 text-foreground">{shortDate(lease.end_date)}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Term</dt>
                <dd className="mt-1 text-foreground">{months} months</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Created</dt>
                <dd className="mt-1 text-foreground">{shortDate(lease.created_at)}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-2 text-foreground"><Home className="w-4 h-4" /><h2 className="font-semibold">Unit</h2></div>
            <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <div>
                <dt className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Property</dt>
                <dd className="mt-1 font-medium text-foreground">{property?.name ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Unit</dt>
                <dd className="mt-1 text-foreground">{unit?.label ?? "—"}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Address</dt>
                <dd className="mt-1 text-foreground">{[property?.address, property?.city, property?.state, property?.zip].filter(Boolean).join(", ") || "—"}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Bedrooms</dt>
                <dd className="mt-1 text-foreground">{unit?.bedrooms ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Bathrooms</dt>
                <dd className="mt-1 text-foreground">{unit?.bathrooms ?? "—"}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-2 text-foreground"><User className="w-4 h-4" /><h2 className="font-semibold">Tenant</h2></div>
            <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <div>
                <dt className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Name</dt>
                <dd className="mt-1 font-medium text-foreground">{tenantName}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Email</dt>
                <dd className="mt-1 text-foreground">{tenant?.email ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Phone</dt>
                <dd className="mt-1 text-foreground">{tenant?.phone_e164 ?? "—"}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-2 text-foreground"><Calendar className="w-4 h-4" /><h2 className="font-semibold">Lease history for this unit</h2></div>
            {otherLeases.length === 0 ? (
              <p className="text-sm text-muted-foreground mt-3">No previous leases for this unit.</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                      <th className="text-left font-medium py-2">Period</th>
                      <th className="text-left font-medium py-2">Status</th>
                      <th className="text-right font-medium py-2">Rent</th>
                      <th className="py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {otherLeases.map(o => (
                      <tr key={o.id} className="border-t border-border">
                        <td className="py-3 text-foreground">{shortDate(o.start_date)} – {shortDate(o.end_date)}</td>
                        <td className="py-3"><StatusPill tone={o.status === "active" ? "success" : "muted"}>{o.status}</StatusPill></td>
                        <td className="py-3 text-right font-mono text-foreground">{money(Number(o.rent_amount))}</td>
                        <td className="py-3 text-right"><Link to={`/landlord/leases/${o.public_slug}`} className="text-primary text-xs hover:underline">View</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-2 text-foreground"><DollarSign className="w-4 h-4" /><h2 className="font-semibold">Rent</h2></div>
            <div className="mt-3 text-3xl font-semibold font-mono text-foreground">{money(Number(lease.rent_amount))}</div>
            <div className="text-sm text-muted-foreground">per month</div>
            <div className="mt-6 pt-6 border-t border-border space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Total over term</span><span className="font-mono font-semibold text-foreground">{money(Number(lease.rent_amount) * months)}</span></div>
            </div>
          </div>

        </div>
      </div>
    </LandlordLayout>
  );
}
