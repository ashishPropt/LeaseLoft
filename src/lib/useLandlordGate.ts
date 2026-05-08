import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface LandlordGate {
  loading: boolean;
  connectOk: boolean;
  subscriptionOk: boolean;
  hasPrice: boolean;
  pricingTableId: string | null;
  customerId: string | null;
  email: string | null;
  ready: boolean;
  refresh: () => Promise<void>;
}

export function useLandlordGate(): LandlordGate {
  const [loading, setLoading] = useState(true);
  const [connectOk, setConnectOk] = useState(false);
  const [subscriptionOk, setSubscriptionOk] = useState(false);
  const [hasPrice, setHasPrice] = useState(false);
  const [pricingTableId, setPricingTableId] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    const { data: s } = await supabase.auth.getSession();
    if (!s.session) { setLoading(false); return; }
    const { data: p } = await supabase
      .from("profiles")
      .select("stripe_connect_charges_enabled, stripe_connect_payouts_enabled, stripe_subscription_status, subscription_price_id, stripe_pricing_table_id, stripe_customer_id, email")
      .eq("id", s.session.user.id)
      .maybeSingle();
    const cOk = !!p?.stripe_connect_charges_enabled && !!p?.stripe_connect_payouts_enabled;
    const subOk = ["active", "trialing"].includes(p?.stripe_subscription_status ?? "");
    setConnectOk(cOk);
    setSubscriptionOk(subOk);
    setHasPrice(!!p?.subscription_price_id || !!p?.stripe_pricing_table_id);
    setPricingTableId(p?.stripe_pricing_table_id ?? null);
    setCustomerId(p?.stripe_customer_id ?? null);
    setEmail(p?.email ?? s.session.user.email ?? null);
    setLoading(false);
  }

  useEffect(() => { refresh(); }, []);

  return { loading, connectOk, subscriptionOk, hasPrice, pricingTableId, customerId, email, ready: connectOk && subscriptionOk, refresh };
}
