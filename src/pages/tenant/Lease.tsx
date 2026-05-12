import { useEffect, useState } from "react";
import { TenantLayout } from "@/components/layout/TenantLayout";
import { StatusPill } from "@/components/layout/StatusPill";
import { useTenantContext } from "@/lib/useTenantContext";
import { money, shortDate } from "@/lib/format";
import { FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface LeaseDetail {
  id: string;
  landlord_id: string;
  unit_id: string;
  rent_amount: number;
  start_date: string;
  end_date: string;
  status: string;
  unit?: { id: string; label: string; bedrooms: number | null; bathrooms: number | null } | null;
  property?: { id: string; name: string; address: string | null; city: string | null; state: string | null; zip: string | null } | null;
  landlordName?: string | null;
}

export default function TenantLease() {
  const { ctx, loading: ctxLoading } = useTenantContext();
  const [leases, setLeases] = useState<LeaseDetail[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ctx?.userId) return;
    (async () => {
      const { data: leaseData } = await supabase
        .from("leases")
        .select("id,landlord_id,unit_id,rent_amount,start_date,end_date,status")
        .eq("tenant_id", ctx.userId)
        .order("start_date", { ascending: false });

      const leaseList = (leaseData ?? []) as LeaseDetail[];

      const enriched = await Promise.all(
        leaseList.map(async (l) => {
          const [{ data: u }, { data: ll }] = await Promise.all([
            supabase
              .from("units")
              .select("id,label,bedrooms,bathrooms,property_id")
              .eq("id", l.unit_id)
              .maybeSingle(),
            supabase
              .from("profiles")
              .select("full_name,first_name,last_name,email")
              .eq("id", l.landlord_id)
              .maybeSingle(),
          ]);

          let property = null;
          if (u?.property_id) {
            const { data: p } = await supabase
              .from("properties")
              .select("id,name,address,city,state,zip")
              .eq("id", u.property_id)
              .maybeSingle();
            property = p;
          }

          return {
            ...l,
            unit: u
              ? { id: u.id, label: u.label, bedrooms: u.bedrooms, bathrooms: u.bathrooms }
              : null,
            property: property
              ? {
                  id: property.id,
                  name: property.name,
                  address: property.address,
                  city: property.city,
                  state: property.state,
                  zip: property.zip,
                }
              : null,
            landlordName:
              ll?.full_name ||
              `${ll?.first_name ?? ""} ${ll?.last_name ?? ""}`.trim() ||
              ll?.email ||
              null,
          };
        })
      );

      setLeases(enriched);
      setLoading(false);
    })();
  }, [ctx?.userId]);

  if (ctxLoading || loading) {
    return (
      <TenantLayout crumbs={["My Lease"]}>
        <div className="text-muted-foreground">Loading…</div>
      </TenantLayout>
    );
  }

  if (leases.length === 0) {
    return (
      <TenantLayout crumbs={["My Lease"]}>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">My leases</h1>
        <div className="rounded-xl border border-border bg-card p-8 mt-8 text-center">
          <FileText className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">You don&apos;t have any leases yet.</p>
        </div>
      </TenantLayout>
    );
  }

  return (
    <TenantLayout crumbs={["My Lease"]}>
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">Your leases</h1>
      <div className="mt-8 space-y-6">
        {leases.map((lease) => (
          <LeaseCard key={lease.id} lease={lease} />
        ))}
      </div>
    </TenantLayout>
  );
}

function LeaseCard({ lease }: { lease: LeaseDetail }) {
  const months = Math.max(
    1,
    Math.round((+new Date(lease.end_date) - +new Date(lease.start_date)) / (1000 * 60 * 60 * 24 * 30))
  );

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            {lease.property?.name ?? "—"} · {lease.unit?.label ?? "—"}
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            {shortDate(lease.start_date)} – {shortDate(lease.end_date)}
          </p>
        </div>
        <StatusPill
          tone={
            lease.status === "active" ? "success" : lease.status === "draft" ? "warning" : "muted"
          }
        >
          {lease.status[0].toUpperCase() + lease.status.slice(1)}
        </StatusPill>
      </div>

      <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
        <div>
          <dt className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Property</dt>
          <dd className="mt-1 font-medium text-foreground">{lease.property?.name ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Unit</dt>
          <dd className="mt-1 font-medium text-foreground">{lease.unit?.label ?? "—"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Address</dt>
          <dd className="mt-1 text-foreground">
            {[lease.property?.address, lease.property?.city, lease.property?.state, lease.property?.zip]
              .filter(Boolean)
              .join(", ") || "—"}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Bedrooms</dt>
          <dd className="mt-1 text-foreground">{lease.unit?.bedrooms ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Bathrooms</dt>
          <dd className="mt-1 text-foreground">{lease.unit?.bathrooms ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Start date</dt>
          <dd className="mt-1 text-foreground">{shortDate(lease.start_date)}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">End date</dt>
          <dd className="mt-1 text-foreground">{shortDate(lease.end_date)}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Term length</dt>
          <dd className="mt-1 text-foreground">{months} months</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Landlord</dt>
          <dd className="mt-1 text-foreground">{lease.landlordName ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Monthly rent</dt>
          <dd className="mt-1 font-mono font-semibold text-foreground">{money(lease.rent_amount)}</dd>
        </div>
      </dl>
    </div>
  );
}
