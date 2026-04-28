import { Link } from "react-router-dom";
import { ArrowUpRight, CreditCard, Wrench, FileText } from "lucide-react";
import { TenantLayout } from "@/components/layout/TenantLayout";
import { StatCard } from "@/components/layout/StatCard";
import { StatusPill } from "@/components/layout/StatusPill";
import { Button } from "@/components/ui/button";
import { useTenantContext } from "@/lib/useTenantContext";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { money, shortDate } from "@/lib/format";

export default function TenantDashboard() {
  const { ctx, loading } = useTenantContext();
  const [nextDue, setNextDue] = useState<{ amount: number; due: string; status: "paid" | "due" | "upcoming" | "overdue" } | null>(null);
  const [openTickets, setOpenTickets] = useState(0);

  useEffect(() => {
    if (!ctx?.lease) return;
    (async () => {
      const { data: pays } = await supabase
        .from("payments")
        .select("amount,due_date,status,paid_at")
        .eq("lease_id", ctx.lease!.id)
        .order("due_date", { ascending: true });

      // Build the schedule of 1st-of-month due dates within the lease term.
      const lease = ctx.lease!;
      const start = new Date(lease.start_date);
      const end = new Date(lease.end_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // First due: 1st of the lease's start month (or start date itself if lease begins on the 1st).
      // Use first of the start month, but if start date is after the 1st, the first due is the 1st of the next month.
      let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
      if (start.getDate() > 1) cursor = new Date(start.getFullYear(), start.getMonth() + 1, 1);

      const schedule: Date[] = [];
      while (cursor <= end) {
        schedule.push(new Date(cursor));
        cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      }

      // Index paid payments by YYYY-MM of due_date.
      const paidMonths = new Set(
        (pays ?? [])
          .filter((p) => p.status === "paid")
          .map((p) => {
            const d = new Date(p.due_date);
            return `${d.getFullYear()}-${d.getMonth()}`;
          })
      );

      // Find the next unpaid due date.
      const nextUnpaid = schedule.find((d) => !paidMonths.has(`${d.getFullYear()}-${d.getMonth()}`));

      if (nextUnpaid) {
        const grace = new Date(nextUnpaid);
        grace.setDate(grace.getDate() + 3);
        let status: "due" | "upcoming" | "overdue" = "upcoming";
        if (today > grace) status = "overdue";
        else if (today >= nextUnpaid) status = "due";
        setNextDue({
          amount: Number(lease.rent_amount),
          due: nextUnpaid.toISOString().slice(0, 10),
          status,
        });
      } else if (schedule.length > 0) {
        // All months paid through lease end.
        const last = schedule[schedule.length - 1];
        setNextDue({ amount: Number(lease.rent_amount), due: last.toISOString().slice(0, 10), status: "paid" });
      }

      const { data: m } = await supabase
        .from("maintenance_requests")
        .select("id")
        .eq("lease_id", ctx.lease!.id)
        .in("status", ["open", "in_progress"]);
      setOpenTickets((m ?? []).length);
    })();
  }, [ctx?.lease?.id]);

  if (loading) return <TenantLayout crumbs={["Dashboard"]}><div className="text-muted-foreground">Loading…</div></TenantLayout>;

  return (
    <TenantLayout crumbs={["Dashboard"]}>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Welcome back, {ctx?.name?.split(" ")[0] ?? "there"}</h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            {ctx?.property ? `${ctx.property.name} · ${ctx.unit?.label}` : "No active lease yet."}
          </p>
        </div>
        {ctx?.lease && (
          <Button asChild><Link to="/tenant/pay"><CreditCard className="w-4 h-4 mr-2" />Pay rent</Link></Button>
        )}
      </div>

      {!ctx?.lease ? (
        <div className="rounded-xl border border-border bg-card p-8 mt-8 text-center">
          <FileText className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
          <h2 className="font-semibold text-foreground">No active lease</h2>
          <p className="text-sm text-muted-foreground mt-2">Once your landlord adds a lease for you, it will appear here.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
            <StatCard
              label="Next payment"
              value={nextDue ? money(nextDue.amount) : money(ctx.lease.rent_amount)}
              hint={nextDue ? <StatusPill tone={nextDue.status === "paid" ? "success" : nextDue.status === "failed" ? "danger" : "warning"}>{nextDue.status === "paid" ? "Paid" : `Due ${shortDate(nextDue.due)}`}</StatusPill> : <span className="text-muted-foreground">No payments scheduled</span>}
            />
            <StatCard
              label="Lease ends"
              value={shortDate(ctx.lease.end_date)}
              hint={<span className="text-muted-foreground">Started {shortDate(ctx.lease.start_date)}</span>}
            />
            <StatCard
              label="Open requests"
              value={String(openTickets)}
              hint={<span className="text-muted-foreground">Maintenance tickets</span>}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-foreground">Your home</h2>
                <Link to="/tenant/lease" className="text-sm text-foreground/70 hover:text-foreground inline-flex items-center gap-1">Lease details <ArrowUpRight className="w-3.5 h-3.5" /></Link>
              </div>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Property</span><span className="text-foreground font-medium">{ctx.property?.name}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Unit</span><span className="text-foreground font-medium">{ctx.unit?.label}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Address</span><span className="text-foreground">{[ctx.property?.address, ctx.property?.city].filter(Boolean).join(", ") || "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Landlord</span><span className="text-foreground">{ctx.landlordName ?? "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Monthly rent</span><span className="text-foreground font-mono font-semibold">{money(ctx.lease.rent_amount)}</span></div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="font-semibold text-foreground">Quick actions</h2>
              <div className="mt-4 space-y-2">
                <Button asChild variant="outline" className="w-full justify-start"><Link to="/tenant/pay"><CreditCard className="w-4 h-4 mr-2" />Pay this month's rent</Link></Button>
                <Button asChild variant="outline" className="w-full justify-start"><Link to="/tenant/maintenance"><Wrench className="w-4 h-4 mr-2" />Report an issue</Link></Button>
                <Button asChild variant="outline" className="w-full justify-start"><Link to="/tenant/documents"><FileText className="w-4 h-4 mr-2" />View documents</Link></Button>
              </div>
            </div>
          </div>
        </>
      )}
    </TenantLayout>
  );
}
