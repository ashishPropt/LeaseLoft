import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface LandlordGate {
  loading: boolean;
  connectOk: boolean;
  subscriptionOk: boolean;
  hasPrice: boolean;
  ready: boolean; // both ok
  refresh: () => Promise<void>;
}

export function useLandlordGate(): LandlordGate {
  const [loading, setLoading] = useState(true);
  const [connectOk, setConnectOk] = useState(false);
  const [subscriptionOk, setSubscriptionOk] = useState(false);
  const [hasPrice, setHasPrice] = useState(false);

  async function refresh() {
    setLoading(true);
    const { data: s } = await supabase.auth.getSession();
    if (!s.session) { setLoading(false); return; }
    const { data: p } = await supabase
      .from("profiles")
      .select("stripe_connect_charges_enabled, stripe_connect_payouts_enabled, stripe_subscription_status, subscription_price_id")
      .eq("id", s.session.user.id)
      .maybeSingle();
    const cOk = !!p?.stripe_connect_charges_enabled && !!p?.stripe_connect_payouts_enabled;
    const subOk = ["active", "trialing"].includes(p?.stripe_subscription_status ?? "");
    setConnectOk(cOk);
    setSubscriptionOk(subOk);
    setHasPrice(!!p?.subscription_price_id);
    setLoading(false);
  }

  useEffect(() => { refresh(); }, []);

  return { loading, connectOk, subscriptionOk, hasPrice, ready: connectOk && subscriptionOk, refresh };
}
