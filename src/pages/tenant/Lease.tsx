import { TenantLayout } from "@/components/layout/TenantLayout";
import { StatusPill } from "@/components/layout/StatusPill";
import { useTenantContext } from "@/lib/useTenantContext";
import { money, shortDate } from "@/lib/format";
import { FileText } from "lucide-react";

export default function TenantLease() {
  const { ctx, loading } = useTenantContext();

  if (loading) return <TenantLayout crumbs={["My Lease"]}><div className="text-muted-foreground">Loading…</div></TenantLayout>;

  if (!ctx?.lease) {
    return (
      <TenantLayout crumbs={["My Lease"]}>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">My lease</h1>
        <div className="rounded-xl border border-border bg-card p-8 mt-8 text-center">
          <FileText className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">You don't have an active lease yet.</p>
        </div>
      </TenantLayout>
    );
  }

  const months = Math.max(1, Math.round((+new Date(ctx.lease.end_date) - +new Date(ctx.lease.start_date)) / (1000 * 60 * 60 * 24 * 30)));

  return (
    <TenantLayout crumbs={["My Lease"]}>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Your lease</h1>
          <p className="text-muted-foreground mt-1.5 text-sm">{ctx.property?.name} · {ctx.unit?.label}</p>
        </div>
        <StatusPill tone={ctx.lease.status === "active" ? "success" : "muted"}>
          {ctx.lease.status[0].toUpperCase() + ctx.lease.status.slice(1)}
        </StatusPill>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-8">
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-6">
          <h2 className="font-semibold text-foreground">Lease details</h2>
          <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
            <div>
              <dt className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Property</dt>
              <dd className="mt-1 font-medium text-foreground">{ctx.property?.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Unit</dt>
              <dd className="mt-1 font-medium text-foreground">{ctx.unit?.label}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Address</dt>
              <dd className="mt-1 text-foreground">{[ctx.property?.address, ctx.property?.city, ctx.property?.state, ctx.property?.zip].filter(Boolean).join(", ") || "—"}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Bedrooms</dt>
              <dd className="mt-1 text-foreground">{ctx.unit?.bedrooms ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Bathrooms</dt>
              <dd className="mt-1 text-foreground">{ctx.unit?.bathrooms ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Start date</dt>
              <dd className="mt-1 text-foreground">{shortDate(ctx.lease.start_date)}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">End date</dt>
              <dd className="mt-1 text-foreground">{shortDate(ctx.lease.end_date)}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Term length</dt>
              <dd className="mt-1 text-foreground">{months} months</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Landlord</dt>
              <dd className="mt-1 text-foreground">{ctx.landlordName ?? "—"}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="font-semibold text-foreground">Rent</h2>
          <div className="mt-3 text-3xl font-semibold font-mono text-foreground">{money(ctx.lease.rent_amount)}</div>
          <div className="text-sm text-muted-foreground">per month</div>
          <div className="mt-6 pt-6 border-t border-border space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Total over term</span><span className="font-mono font-semibold text-foreground">{money(ctx.lease.rent_amount * months)}</span></div>
          </div>
        </div>
      </div>
    </TenantLayout>
  );
}
