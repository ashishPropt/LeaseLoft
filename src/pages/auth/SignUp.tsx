import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Step = "code" | "details";

const SignUp = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("code");
  const [inviteCode, setInviteCode] = useState("");
  const [validating, setValidating] = useState(false);
  const [role, setRole] = useState<string>("");
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone_e164: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onValidateCode(e: React.FormEvent) {
    e.preventDefault();
    setValidating(true);
    const code = inviteCode.trim().toUpperCase();
    const { data, error } = await supabase.functions.invoke("validate-invite", {
      body: { invite_code: code },
    });
    setValidating(false);
    if (error || (data && (data as { error?: string }).error)) {
      const msg = (data as { error?: string })?.error || error?.message || "Could not validate code";
      toast.error(msg);
      return;
    }
    const invite = (data as { invite: { role: string; email: string; first_name: string; last_name: string } }).invite;
    setRole(invite.role);
    setForm((f) => ({
      ...f,
      email: invite.email,
      first_name: invite.first_name,
      last_name: invite.last_name,
    }));
    setInviteCode(code);
    setStep("details");
    toast.success("Invite verified. Complete your profile to continue.");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("signup-with-invite", {
      body: { ...form, invite_code: inviteCode },
    });
    if (error || (data && (data as { error?: string }).error)) {
      const msg = (data as { error?: string })?.error || error?.message || "Signup failed";
      toast.error(msg);
      setLoading(false);
      return;
    }
    const { error: signErr } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    });
    if (signErr) { toast.error(signErr.message); setLoading(false); return; }

    const { error: sendErr } = await supabase.functions.invoke("send-sms-otp");
    if (sendErr) { toast.error("Could not send verification code"); setLoading(false); return; }

    toast.success("Account created. Verify your phone to continue.");
    navigate("/verify-2fa");
  }

  return (
    <AuthLayout
      title="Join LeaseLoft"
      subtitle={
        step === "code"
          ? "LeaseLoft is invite-only. Enter the code you received to begin."
          : "Invite verified. Complete your profile to create your account."
      }
      footer={
        <>
          Already have an account?{" "}
          <Link to="/signin" className="text-primary font-medium hover:underline">Sign in</Link>
        </>
      }
    >
      {step === "code" ? (
        <form onSubmit={onValidateCode} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite">Invite code</Label>
            <Input
              id="invite"
              placeholder="XX-YYYY-ZZZZ"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              className="font-mono tracking-wider uppercase"
              required
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Try <code className="font-mono">LL-2026-XJ4K</code> or <code className="font-mono">TN-2026-A7B3</code>.
            </p>
          </div>
          <Button type="submit" className="w-full" disabled={validating}>
            {validating ? "Verifying…" : "Verify code"}
          </Button>
        </form>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2">
            <div className="text-xs">
              <div className="text-muted-foreground">Invite code</div>
              <div className="font-mono font-medium">{inviteCode}</div>
            </div>
            <div className="flex items-center gap-2">
              {role && <Badge variant="secondary" className="capitalize">{role}</Badge>}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => { setStep("code"); setRole(""); }}
              >
                Change
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="first">First name</Label>
              <Input id="first" required value={form.first_name} onChange={(e) => set("first_name", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last">Last name</Label>
              <Input id="last" required value={form.last_name} onChange={(e) => set("last_name", e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={form.email} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Mobile phone (E.164)</Label>
            <Input
              id="phone"
              placeholder="+15558675310"
              required
              value={form.phone_e164}
              onChange={(e) => set("phone_e164", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Used for SMS two-factor authentication.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={8}
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating account…" : "Create account"}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
};

export default SignUp;
