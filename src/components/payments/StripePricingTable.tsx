import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      "stripe-pricing-table": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
        "pricing-table-id": string;
        "publishable-key": string;
        "customer-email"?: string;
        "client-reference-id"?: string;
      }, HTMLElement>;
    }
  }
}

let scriptLoading: Promise<void> | null = null;
function loadStripeScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if ((window as any).customElements?.get?.("stripe-pricing-table")) return Promise.resolve();
  if (scriptLoading) return scriptLoading;
  scriptLoading = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src="https://js.stripe.com/v3/pricing-table.js"]');
    if (existing) { existing.addEventListener("load", () => resolve()); return; }
    const s = document.createElement("script");
    s.src = "https://js.stripe.com/v3/pricing-table.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Stripe pricing table"));
    document.head.appendChild(s);
  });
  return scriptLoading;
}

export function StripePricingTable({
  pricingTableId,
  customerEmail,
  clientReferenceId,
}: {
  pricingTableId: string;
  customerEmail?: string | null;
  clientReferenceId?: string | null;
}) {
  const [pk, setPk] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("stripe-public-config");
        if (error) throw error;
        const key = (data as { publishableKey?: string })?.publishableKey;
        if (!key) throw new Error("Stripe publishable key not configured");
        setPk(key);
        await loadStripeScript();
        setReady(true);
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, []);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!ready || !pk) return <p className="text-sm text-muted-foreground">Loading pricing…</p>;

  return (
    <stripe-pricing-table
      pricing-table-id={pricingTableId}
      publishable-key={pk}
      {...(customerEmail ? { "customer-email": customerEmail } : {})}
      {...(clientReferenceId ? { "client-reference-id": clientReferenceId } : {})}
    />
  );
}
