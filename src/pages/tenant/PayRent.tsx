import { useEffect, useState } from "react";
import { CreditCard, CheckCircle2 } from "lucide-react";
import { TenantLayout } from "@/components/layout/TenantLayout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTenantContext } from "@/lib/useTenantContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { money, shortDate } from "@/lib/format";

export default function TenantPayRent() {
  const { ctx, loading } = useTenantContext();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("ach");
  const [submitting, setSubmitting] = useState(false);
  const [pending, setPending] = useState<{ id: string; amount: number; due_date: string } | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!ctx?.lease) return;
    setAmount(String(ctx.lease.rent_amount));
    (async () => {
      const { data } = await supabase
        .from("payments")
        .select("id,amount,due_date,status")
        .eq("lease_id", ctx.lease!.id)
        .neq("status", "paid")
        .order("due_date", { ascending: true })
        .limit(1);
      if (data && data[0]) {
        setPending({ id: data[0].id, amount: Number(data[0].amount), due_date: data[0].due_date });
        setAmount(String(data[0].amount));
      }
    })();
  }, [ctx?.lease?.id]);

  async function pay() {
    if (!ctx?.lease) return;
    const amt = Number(amount);
    if (!amt || amt <= 0) return toast({ title: "Enter a valid amount", variant: "destructive" });
    setSubmitting(true);
    const now = new Date().toISOString();
    let error;
    if (pending) {
      ({ error } = await supabase.from("payments").update({
        status: "paid", paid_at: now, method, amount: amt,
      }).eq("id", pending.id));
    } else {
      ({ error } = await supabase.from("payments").insert({
        lease_id: ctx.lease.id,
        amount: amt,
        due_date: new Date().toISOString().slice(0, 10),
        paid_at: now,
        status: "paid",
        method,
      }));
    }
    setSubmitting(false);
    if (error) return toast({ title: "Payment failed", description: error.message, variant: "destructive" });
    setSuccess(true);
    toast({ title: "Payment recorded", description: `${money(amt)} paid via ${method}.` });
  }

  if (loading) return <TenantLayout crumbs={["Pay Rent"]}><div className="text-muted-foreground">Loading…</div></TenantLayout>;

  if (!ctx?.lease) {
    return (
      <TenantLayout crumbs={["Pay Rent"]}>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Pay rent</h1>
        <div className="rounded-xl border border-border bg-card p-8 mt-8 text-center text-muted-foreground">
          You don't have an active lease.
        </div>
      </TenantLayout>
    );
  }

  if (success) {
    return (
      <TenantLayout crumbs={["Pay Rent"]}>
        <div className="max-w-lg mx-auto rounded-xl border border-border bg-card p-10 mt-8 text-center">
          <div className="w-14 h-14 rounded-full bg-primary-tint text-primary grid place-items-center mx-auto">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground mt-4">Payment received</h1>
          <p className="text-muted-foreground mt-2">{money(Number(amount))} has been recorded for {ctx.property?.name} · {ctx.unit?.label}.</p>
          <div className="mt-6 flex gap-2 justify-center">
            <Button variant="outline" onClick={() => { setSuccess(false); setPending(null); }}>Make another payment</Button>
            <Button asChild><a href="/tenant/payments">View history</a></Button>
          </div>
        </div>
      </TenantLayout>
    );
  }

  return (
    <TenantLayout crumbs={["Pay Rent"]}>
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">Pay rent</h1>
      <p className="text-muted-foreground mt-1.5 text-sm">{ctx.property?.name} · {ctx.unit?.label}</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-8">
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-6">
          <h2 className="font-semibold text-foreground">Payment details</h2>
          <div className="space-y-4 mt-5 max-w-md">
            <div>
              <Label>Amount (USD)</Label>
              <Input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
            <div>
              <Label>Method</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ach">Bank transfer (ACH)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={pay} disabled={submitting}>
              <CreditCard className="w-4 h-4 mr-2" />
              {submitting ? "Processing…" : `Pay ${money(Number(amount) || 0)}`}
            </Button>
            <p className="text-xs text-muted-foreground">This is a demo — no real charge is made.</p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="font-semibold text-foreground">Summary</h2>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Monthly rent</span><span className="font-mono font-semibold text-foreground">{money(ctx.lease.rent_amount)}</span></div>
            {pending ? (
              <>
                <div className="flex justify-between"><span className="text-muted-foreground">Outstanding</span><span className="font-mono font-semibold text-foreground">{money(pending.amount)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Due</span><span className="text-foreground">{shortDate(pending.due_date)}</span></div>
              </>
            ) : (
              <div className="text-muted-foreground">No outstanding charges. You can still record a payment for this month.</div>
            )}
          </div>
        </div>
      </div>
    </TenantLayout>
  );
}
