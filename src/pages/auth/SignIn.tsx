import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const SignIn = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [smsConsent, setSmsConsent] = useState(false);
  const [initialConsent, setInitialConsent] = useState(false);
  const [loading, setLoading] = useState(false);

  // Prefill from existing profile when an email matching a signed-in session is present.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || cancelled) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("sms_2fa_consent")
        .eq("id", session.user.id)
        .maybeSingle();
      if (cancelled) return;
      if (profile?.sms_2fa_consent) {
        setSmsConsent(true);
        setInitialConsent(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error(error.message);
        return;
      }
      const userId = data.user?.id;
      let dest: string | null = null;

      if (userId) {
        for (let attempt = 0; attempt < 3 && !dest; attempt++) {
          if (attempt > 0) await new Promise((r) => setTimeout(r, 250));
          const { data: roles, error: rolesErr } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", userId);
          if (rolesErr) {
            console.error("Role lookup error", rolesErr);
            continue;
          }
          const allRoles = (roles ?? []).map((r: any) => r.role);
          if (allRoles.includes("admin")) dest = "/admin";
          else if (allRoles.includes("landlord")) dest = "/landlord";
          else if (allRoles.includes("tenant")) dest = "/tenant";
        }
      }

      if (!dest) {
        console.error("No role found for user after sign-in", userId);
        toast.error("Your account has no role assigned. Contact an administrator.");
        await supabase.auth.signOut();
        return;
      }

      // Persist 2FA SMS consent change to profile (timestamp + source).
      if (userId && smsConsent !== initialConsent) {
        const { error: consentErr } = await supabase
          .from("profiles")
          .update({
            sms_2fa_consent: smsConsent,
            sms_2fa_consent_at: smsConsent ? new Date().toISOString() : null,
            sms_2fa_consent_source: smsConsent ? "signin_page" : null,
          })
          .eq("id", userId);
        if (consentErr) console.error("Failed to save SMS consent", consentErr);
      }

      // If user opted into SMS 2FA and has a phone, send OTP and route to verify page.
      if (userId && smsConsent) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("phone_e164")
          .eq("id", userId)
          .maybeSingle();
        if (profile?.phone_e164) {
          const { error: sendErr } = await supabase.functions.invoke("send-sms-otp");
          if (sendErr) {
            toast.error("Could not send verification code. Try again.");
            return;
          }
          toast.success("Verification code sent");
          navigate("/verify-2fa", { replace: true, state: { from: { pathname: dest } } });
          return;
        }
      }

      toast.success("Signed in");
      navigate(dest, { replace: true });
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in with your email and password."
      footer={
        <>
          Have an invite code?{" "}
          <Link to="/signup" className="text-primary font-medium hover:underline">
            Join with invite
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link to="/reset-password" className="text-xs text-primary hover:underline">Forgot?</Link>
          </div>
          <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </Button>
        <p className="text-xs text-muted-foreground leading-relaxed">
          By signing in, you agree to our{" "}
          <Link to="/terms" className="text-primary hover:underline">Terms of Use</Link> and{" "}
          <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>. We never sell or share
          your personal information with third parties for marketing.
        </p>
      </form>
    </AuthLayout>
  );
};

export default SignIn;
