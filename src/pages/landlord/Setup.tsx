import { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { LandlordLayout } from "@/components/layout/LandlordLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, CreditCard, Landmark, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useLandlordGate } from "@/lib/useLandlordGate";

export default function LandlordSetup() {
  const gate = useLandlordGate();
  const [busy, setBusy] = useState(false);
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();

  const refreshSub = useCallback(async () => {
    await supabase.functions.invoke("landlord-subscription-status");
    await gate.refresh();
  }, [gate]);

  // After returning from Stripe checkout/onboarding, refresh.
  useEffect(() => {
    if (params.get("sub_return") || params.get("stripe_return") || params.get("stripe_refresh")) {
      refreshSub();
      const next = new URLSearchParams(params);
      ["sub_return", "sub_cancel", "stripe_return", "stripe_refresh"].forEach((k) => next.delete(k));
      setParams(next, { replace: true });
    }
  }, [params, setParams, refreshSub]);

  // Auto-redirect once both done.
  useEffect(() => {
    if (!gate.loading && gate.ready) navigate("/landlord", { replace: true });
  }, [gate.loading, gate.ready, navigate]);

  async function startConnect() {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("stripe-connect-onboard", {
      body: { return_url_origin: window.location.origin },
    });
    setBusy(false);
    if (error) return toast({ title: "Could not start onboarding", description: error.message, variant: "destructive" });
    if (data?.url) window.location.href = data.url as string;
  }

  async function startSubscribe() {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("landlord-subscription-checkout", {
      body: { return_url_origin: window.location.origin },
    });
    setBusy(false);
    if (error) return toast({ title: "Could not start subscription", description: error.message, variant: "destructive" });
    if (data?.url) window.location.href = data.url as string;
  }

  return (
    <LandlordLayout crumbs={["Setup"]}>
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">Finish setting up your account</h1>
      <p className="text-muted-foreground mt-1.5 text-sm max-w-2xl">
        Complete these two steps to start managing properties, tenants, and payments.
      </p>

      <div className="mt-8 grid gap-4 max-w-3xl">
        {/* Step 1: Stripe Connect */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-start gap-4">
            <div className="mt-1">
              {gate.connectOk
                ? <CheckCircle2 className="w-6 h-6 text-green-600" />
                : <Circle className="w-6 h-6 text-muted-foreground" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Landmark className="w-4 h-4 text-muted-foreground" />
                <h2 className="font-semibold text-foreground">1. Connect your bank for payouts</h2>
                {gate.connectOk && <Badge variant="secondary">Done</Badge>}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Connect a Stripe account so tenant rent payments can be deposited to your bank.
              </p>
            </div>
            <div>
              {!gate.connectOk && (
                <Button onClick={startConnect} disabled={busy || gate.loading}>
                  Connect with Stripe
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Step 2: Subscription */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-start gap-4">
            <div className="mt-1">
              {gate.subscriptionOk
                ? <CheckCircle2 className="w-6 h-6 text-green-600" />
                : <Circle className="w-6 h-6 text-muted-foreground" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-muted-foreground" />
                <h2 className="font-semibold text-foreground">2. Subscribe to the platform</h2>
                {gate.subscriptionOk && <Badge variant="secondary">Active</Badge>}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {gate.hasPrice
                  ? "Subscribe to unlock the full platform. You'll be redirected to Stripe to complete payment."
                  : "An administrator hasn't assigned a plan to your account yet. Please contact support."}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={refreshSub} disabled={busy || gate.loading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${gate.loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              {!gate.subscriptionOk && (
                <Button onClick={startSubscribe} disabled={busy || gate.loading || !gate.hasPrice}>
                  Subscribe
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </LandlordLayout>
  );
}
