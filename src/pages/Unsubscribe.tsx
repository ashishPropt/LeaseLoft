import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

type State = "loading" | "valid" | "already" | "invalid" | "submitting" | "done" | "error";

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<State>("loading");
  const [errMsg, setErrMsg] = useState<string>("");

  useEffect(() => {
    if (!token) {
      setState("invalid");
      return;
    }
    (async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`,
          { headers: { apikey: ANON } },
        );
        const data = await res.json();
        if (!res.ok) {
          setState("invalid");
          setErrMsg(data?.error ?? "Invalid link");
          return;
        }
        if (data.valid === false && data.reason === "already_unsubscribed") {
          setState("already");
        } else if (data.valid) {
          setState("valid");
        } else {
          setState("invalid");
        }
      } catch (e) {
        setState("invalid");
        setErrMsg((e as Error).message);
      }
    })();
  }, [token]);

  async function confirm() {
    setState("submitting");
    try {
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe`,
        {
          method: "POST",
          headers: { apikey: ANON, "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        setState("error");
        setErrMsg(data?.error ?? "Could not unsubscribe");
        return;
      }
      setState("done");
    } catch (e) {
      setState("error");
      setErrMsg((e as Error).message);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-sm">
        <div className="flex justify-center mb-6"><Logo /></div>
        <h1 className="text-xl font-semibold text-foreground text-center">Email preferences</h1>

        <div className="mt-6 text-sm text-muted-foreground text-center min-h-[80px]">
          {state === "loading" && <p>Checking your link…</p>}
          {state === "valid" && (
            <p>Click below to unsubscribe from LeaseLoft notification emails. You'll still receive essential account and security messages.</p>
          )}
          {state === "submitting" && <p>Updating your preferences…</p>}
          {state === "done" && <p className="text-foreground">You've been unsubscribed. We're sorry to see you go.</p>}
          {state === "already" && <p>This email address is already unsubscribed.</p>}
          {state === "invalid" && <p>This unsubscribe link is invalid or expired. {errMsg}</p>}
          {state === "error" && <p>Something went wrong. {errMsg}</p>}
        </div>

        {state === "valid" && (
          <Button className="w-full mt-4" onClick={confirm}>Confirm unsubscribe</Button>
        )}

        <div className="mt-8 text-center">
          <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">Back to LeaseLoft</Link>
        </div>
      </div>
    </div>
  );
}
