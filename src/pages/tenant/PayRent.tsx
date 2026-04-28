import { useEffect, useState } from "react";
import { CreditCard, CheckCircle2, Loader2, Landmark, Trash2 } from "lucide-react";
import { TenantLayout } from "@/components/layout/TenantLayout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useTenantContext } from "@/lib/useTenantContext";
import { usePaymentMethods } from "@/lib/usePaymentMethods";
import { PlaidLinkButton } from "@/components/payments/PlaidLinkButton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { money, shortDate } from "@/lib/format";

export default function TenantPayRent() {
  const { ctx, loading } = useTenantContext();
  const { methods, loading: pmLoading, refresh: refreshMethods } = usePaymentMethods();
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pending, setPending] = useState<{ id: string; amount: number; due_date: string; status: string } | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<string>("");
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
        setPending({ id: data[0].id, amount: Number(data[0].amount), due_date: data[0].due_date, status: data[0].status });
        setAmount(String(data[0].amount));
      }
    })();
  }, [ctx?.lease?.id]);

  useEffect(() => {
    if (!selectedMethod && methods[0]) setSelectedMethod(methods[0].id);
  }, [methods, selectedMethod]);

  async function pay() {
    if (!ctx?.lease) return;
    if (!selectedMethod) return toast({ title: "Select a bank account", variant: "destructive" });
    const amt = Number(amount);
    if (!amt || amt <= 0) return toast({ title: "Enter a valid amount", variant: "destructive" });

    setSubmitting(true);

    // Ensure a payment row exists to use as idempotency key
    let paymentId = pending?.id ?? null;
    if (!paymentId) {
      const { data, error } = await supabase
        .from("payments")
        .insert({
          lease_id: ctx.lease.id,
          amount: amt,
          due_date: new Date().toISOString().slice(0, 10),
          status: "pending",
          method: "ach",
        })
        .select("id")
        .single();
      if (error || !data) {
        setSubmitting(false);
        return toast({ title: "Could not create payment", description: error?.message, variant: "destructive" });
      }
      paymentId = data.id;
    }

    const { data: res, error } = await supabase.functions.invoke("payment-initiate", {
      body: { payment_id: paymentId, payment_method_id: selectedMethod, amount_cents: Math.round(amt * 100) },
    });
    setSubmitting(false);

    if (error) return toast({ title: "Payment failed", description: error.message, variant: "destructive" });
    if (res?.status === "failed") {
      return toast({ title: "Payment declined", description: res.failure_reason || "ACH authorization declined", variant: "destructive" });
    }
    setSuccess(true);
    toast({
      title: res?.status === "paid" ? "Payment completed" : "Payment submitted",
      description: res?.status === "paid"
        ? `${money(amt)} paid via ACH.`
        : `${money(amt)} is processing — ACH typically clears in 1–3 business days.`,
    });
  }

  async function removeMethod(id: string) {
    const { error } = await supabase.from("payment_methods").update({ status: "revoked" }).eq("id", id);
    if (error) return toast({ title: "Could not remove", description: error.message, variant: "destructive" });
    if (selectedMethod === id) setSelectedMethod("");
    refreshMethods();
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
          <h1 className="text-2xl font-semibold tracking-tight text-foreground mt-4">Payment submitted</h1>
          <p className="text-muted-foreground mt-2">
            {money(Number(amount))} for {ctx.property?.name} · {ctx.unit?.label}.
            ACH typically clears in 1–3 business days. We'll update the status automatically.
          </p>
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

          <div className="space-y-5 mt-5 max-w-md">
            <div>
              <Label>Amount (USD)</Label>
              <Input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} />
            </div>

            <div>
              <Label>Bank account (ACH)</Label>
              {pmLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading bank accounts…
                </div>
              ) : methods.length === 0 ? (
                <div className="mt-2 rounded-md border border-dashed border-border p-4 text-sm">
                  <p className="text-muted-foreground mb-3">No bank account linked yet. Link your bank securely with Plaid to pay rent via ACH.</p>
                  <PlaidLinkButton onLinked={refreshMethods} />
                </div>
              ) : (
                <>
                  <RadioGroup value={selectedMethod} onValueChange={setSelectedMethod} className="mt-2">
                    {methods.map(m => (
                      <label key={m.id} className="flex items-center gap-3 rounded-md border border-border p-3 cursor-pointer hover:bg-muted/50">
                        <RadioGroupItem value={m.id} id={m.id} />
                        <Landmark className="w-4 h-4 text-muted-foreground" />
                        <span className="flex-1 text-sm">
                          <span className="font-medium text-foreground">{m.bank_name ?? "Bank"}</span>
                          <span className="text-muted-foreground"> · {m.account_type ?? "checking"} ••{m.account_mask}</span>
                        </span>
                        <Button type="button" size="icon" variant="ghost" onClick={(e) => { e.preventDefault(); removeMethod(m.id); }}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </label>
                    ))}
                  </RadioGroup>
                  <div className="mt-3">
                    <PlaidLinkButton onLinked={refreshMethods} variant="outline" label="Link another bank" />
                  </div>
                </>
              )}
            </div>

            <Button className="w-full" onClick={pay} disabled={submitting || methods.length === 0}>
              <CreditCard className="w-4 h-4 mr-2" />
              {submitting ? "Processing…" : `Pay ${money(Number(amount) || 0)}`}
            </Button>
            <p className="text-xs text-muted-foreground">Bank-to-bank transfer (ACH). Funds typically clear in 1–3 business days.</p>
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
                {pending.status === "processing" && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span className="text-foreground">Processing</span></div>
                )}
              </>
            ) : (
              <div className="text-muted-foreground">No outstanding charges.</div>
            )}
          </div>
        </div>
      </div>
    </TenantLayout>
  );
}
