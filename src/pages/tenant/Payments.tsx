import { useEffect, useState } from "react";
import { TenantLayout } from "@/components/layout/TenantLayout";
import { StatusPill } from "@/components/layout/StatusPill";
import { useTenantContext } from "@/lib/useTenantContext";
import { supabase } from "@/integrations/supabase/client";
import { money, shortDate } from "@/lib/format";

interface Row { id: string; amount: number; due: string; paid: string | null; method: string | null; status: string; }

export default function TenantPayments() {
  const { ctx } = useTenantContext();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ctx?.lease) { setLoading(false); return; }
    (async () => {
      const { data } = await supabase
        .from("payments")
        .select("id,amount,due_date,paid_at,method,status")
        .eq("lease_id", ctx.lease!.id)
        .order("due_date", { ascending: true });
      setRows((data ?? []).map((p: any) => ({
        id: p.id, amount: Number(p.amount), due: p.due_date, paid: p.paid_at, method: p.method, status: p.status,
      })));
      setLoading(false);
    })();
  }, [ctx?.lease?.id]);

  const totalPaid = rows.filter(r => r.status === "paid").reduce((s, r) => s + r.amount, 0);
  const outstanding = rows.filter(r => r.status !== "paid").reduce((s, r) => s + r.amount, 0);

  return (
    <TenantLayout crumbs={["Payment History"]}>
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">Payment history</h1>
      <p className="text-muted-foreground mt-1.5 text-sm">
        {money(totalPaid)} paid · {money(outstanding)} outstanding
      </p>

      <div className="rounded-xl border border-border bg-card mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              <th className="text-left font-medium px-6 py-4">Due</th>
              <th className="text-left font-medium px-6 py-4">Paid</th>
              <th className="text-left font-medium px-6 py-4">Method</th>
              <th className="text-left font-medium px-6 py-4">Status</th>
              <th className="text-right font-medium px-6 py-4">Amount</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">No payments yet.</td></tr>
            ) : rows.map(r => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-6 py-4 text-foreground">{shortDate(r.due)}</td>
                <td className="px-6 py-4 text-muted-foreground">{r.paid ? shortDate(r.paid) : "—"}</td>
                <td className="px-6 py-4 text-muted-foreground">{r.method ?? "—"}</td>
                <td className="px-6 py-4">
                  <StatusPill tone={r.status === "paid" ? "success" : r.status === "pending" ? "warning" : r.status === "failed" ? "danger" : "muted"}>
                    {r.status[0].toUpperCase() + r.status.slice(1)}
                  </StatusPill>
                </td>
                <td className="px-6 py-4 text-right font-mono font-medium text-foreground">{money(r.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </TenantLayout>
  );
}
