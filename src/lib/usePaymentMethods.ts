import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PaymentMethod {
  id: string;
  bank_name: string | null;
  account_mask: string | null;
  account_type: string | null;
  status: string;
  created_at: string;
}

export function usePaymentMethods() {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data: s } = await supabase.auth.getSession();
    if (!s.session) {
      setMethods([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("payment_methods")
      .select("id, bank_name, account_mask, account_type, status, created_at")
      .eq("tenant_id", s.session.user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false });
    setMethods((data ?? []) as PaymentMethod[]);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { methods, loading, refresh };
}
