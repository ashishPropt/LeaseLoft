import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Landmark } from "lucide-react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

let stripePromise: Promise<Stripe | null> | null = null;
function getStripe(publishableKey: string) {
  if (!stripePromise) stripePromise = loadStripe(publishableKey);
  return stripePromise;
}

interface Props {
  onLinked: () => void;
  label?: string;
  variant?: "default" | "outline";
}

export function StripeBankLinkButton({ onLinked, label = "Link your bank", variant = "default" }: Props) {
  const [loading, setLoading] = useState(false);

  async function open() {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("payment-link-token");
      if (error) throw error;
      const clientSecret = data?.link_token as string | undefined;
      const publishableKey = data?.publishable_key as string | undefined;
      if (!clientSecret || !publishableKey) throw new Error("Stripe configuration missing");

      const stripe = await getStripe(publishableKey);
      if (!stripe) throw new Error("Stripe failed to load");

      const stripeAny = stripe as unknown as { collectFinancialConnectionsAccounts: (opts: { clientSecret: string }) => Promise<{ error?: { message?: string }; financialConnectionsSession?: { accounts: Array<{ id: string }> } }> };
      const result = await stripeAny.collectFinancialConnectionsAccounts({ clientSecret });
      if (result.error) throw new Error(result.error.message || "Bank link failed");

      const accounts = result.financialConnectionsSession?.accounts ?? [];
      if (accounts.length === 0) {
        toast({ title: "No account selected" });
        return;
      }
      const accountId = accounts[0].id;

      const { error: exErr } = await supabase.functions.invoke("payment-exchange-token", {
        body: { account_id: accountId },
      });
      if (exErr) {
        toast({ title: "Failed to link bank", description: exErr.message, variant: "destructive" });
        return;
      }
      toast({ title: "Bank linked successfully" });
      onLinked();
    } catch (e) {
      toast({ title: "Could not link bank", description: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button onClick={open} disabled={loading} variant={variant}>
      <Landmark className="w-4 h-4 mr-2" />
      {loading ? "Opening…" : label}
    </Button>
  );
}
