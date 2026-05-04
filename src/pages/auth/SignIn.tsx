import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const SignIn = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error(error.message);
        return;
      }
      // 2FA temporarily disabled — keep send/verify edge functions and Verify2FA page for later re-enable.
      const userId = data.user?.id;
      let dest: string | null = null;

      if (userId) {
        // Retry role lookup up to 3 times — session propagation to PostgREST can lag briefly after sign-in.
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
        <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground leading-relaxed">
          <p className="mt-2">
            We never sell or share your personal information with third parties for marketing. See our{" "}
            <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link> and{" "}
            <Link to="/terms" className="text-primary hover:underline">Terms of Use</Link>.
          </p>
        </div>
      </form>
    </AuthLayout>
  );
};

export default SignIn;
