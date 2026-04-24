import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getDeviceId } from "@/lib/device";
import { Logo } from "@/components/Logo";

interface Props {
  children: React.ReactNode;
  requireRole?: "admin" | "landlord" | "tenant";
}

export const RequireAuth = ({ children, requireRole }: Props) => {
  const location = useLocation();
  const [state, setState] = useState<"loading" | "no-session" | "needs-mfa" | "wrong-role" | "ok">("loading");

  useEffect(() => {
    let cancelled = false;

    async function check() {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) { if (!cancelled) setState("no-session"); return; }

      const userId = sess.session.user.id;
      const deviceId = getDeviceId();

      // 2FA temporarily disabled. Keep mfa_sessions check below for later re-enable.
      const SKIP_MFA = true;
      if (!SKIP_MFA) {
        const { data: mfa } = await supabase
          .from("mfa_sessions")
          .select("expires_at")
          .eq("user_id", userId)
          .eq("device_id", deviceId)
          .maybeSingle();

        const valid = mfa && new Date(mfa.expires_at) > new Date();
        if (!valid) { if (!cancelled) setState("needs-mfa"); return; }
      }

      if (requireRole) {
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId);
        const has = roles?.some((r) => r.role === requireRole);
        if (!has) { if (!cancelled) setState("wrong-role"); return; }
      }

      if (!cancelled) setState("ok");
    }

    check();
    const { data: listener } = supabase.auth.onAuthStateChange(() => check());
    return () => { cancelled = true; listener.subscription.unsubscribe(); };
  }, [requireRole, location.pathname]);

  if (state === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Logo size="md" />
      </div>
    );
  }
  if (state === "no-session") return <Navigate to="/signin" state={{ from: location }} replace />;
  if (state === "needs-mfa") return <Navigate to="/verify-2fa" state={{ from: location }} replace />;
  if (state === "wrong-role") return <Navigate to="/" replace />;
  return <>{children}</>;
};
