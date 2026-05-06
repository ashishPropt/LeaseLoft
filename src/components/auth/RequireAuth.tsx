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
      // Race getSession against a timeout — in some preview contexts it can hang.
      const sessionPromise = supabase.auth.getSession().then((r) => r.data.session);
      const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500));
      const session = await Promise.race([sessionPromise, timeout]);

      if (cancelled) return;
      if (!session) { setState("no-session"); return; }

      const userId = session.user.id;

      // 2FA temporarily disabled — MFA enforcement skipped.

      if (requireRole) {
        // Retry role lookup — PostgREST/RLS context can lag briefly after a fresh load.
        let allowed = false;
        for (let attempt = 0; attempt < 3; attempt++) {
          if (attempt > 0) await new Promise((r) => setTimeout(r, 250));
          const { data: roles, error } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", userId);
          if (cancelled) return;
          if (error) { console.error("RequireAuth role lookup error", error); continue; }
          if (roles?.some((r) => r.role === requireRole)) { allowed = true; break; }
          // If we got an empty array, no need to retry further unless first attempt.
          if (roles && roles.length > 0) break;
        }
        if (!allowed) { if (!cancelled) setState("wrong-role"); return; }
      }

      if (!cancelled) setState("ok");
    }

    check();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      // Only re-check on meaningful auth changes, not on token refresh noise.
      if (_event === "SIGNED_OUT" || _event === "SIGNED_IN") check();
    });
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
