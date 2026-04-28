import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Landmark } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

declare global {
  interface Window {
    Plaid?: {
      create: (config: {
        token: string;
        onSuccess: (publicToken: string, metadata: { accounts: Array<{ id: string }> }) => void;
        onExit: (err: unknown) => void;
      }) => { open: () => void; exit: () => void; destroy: () => void };
    };
  }
}

const PLAID_SCRIPT = "https://cdn.plaid.com/link/v2/stable/link-initialize.js";

function loadPlaid(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Plaid) return resolve();
    const existing = document.querySelector(`script[src="${PLAID_SCRIPT}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load Plaid")));
      return;
    }
    const s = document.createElement("script");
    s.src = PLAID_SCRIPT;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Plaid"));
    document.body.appendChild(s);
  });
}

interface Props {
  onLinked: () => void;
  label?: string;
  variant?: "default" | "outline";
}

export function PlaidLinkButton({ onLinked, label = "Link your bank", variant = "default" }: Props) {
  const [loading, setLoading] = useState(false);
  const handlerRef = useRef<ReturnType<NonNullable<typeof window.Plaid>["create"]> | null>(null);

  useEffect(() => {
    return () => { handlerRef.current?.destroy(); };
  }, []);

  async function open() {
    setLoading(true);
    try {
      await loadPlaid();
      const { data, error } = await supabase.functions.invoke("payment-link-token");
      if (error) throw error;
      if (!data?.link_token) throw new Error("No link token returned");

      const handler = window.Plaid!.create({
        token: data.link_token,
        onSuccess: async (publicToken, metadata) => {
          const accountId = metadata.accounts?.[0]?.id;
          if (!accountId) {
            toast({ title: "No account selected", variant: "destructive" });
            return;
          }
          const { error: exErr } = await supabase.functions.invoke("payment-exchange-token", {
            body: { public_token: publicToken, account_id: accountId },
          });
          if (exErr) {
            toast({ title: "Failed to link bank", description: exErr.message, variant: "destructive" });
            return;
          }
          toast({ title: "Bank linked successfully" });
          onLinked();
        },
        onExit: (err) => { if (err) console.warn("[Plaid] exit", err); },
      });
      handlerRef.current = handler;
      handler.open();
    } catch (e) {
      toast({ title: "Could not open Plaid", description: (e as Error).message, variant: "destructive" });
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
