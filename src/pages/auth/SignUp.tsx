import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Check, X } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { supabase } from "@/integrations/supabase/client";
import { getDeviceId } from "@/lib/device";
import { toast } from "sonner";

type Step = "code" | "details" | "verify";

const PW_RULES = [
  { id: "len", label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { id: "upper", label: "One uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { id: "lower", label: "One lowercase letter", test: (p: string) => /[a-z]/.test(p) },
  { id: "num", label: "One number", test: (p: string) => /\d/.test(p) },
  { id: "sym", label: "One symbol (!@#$…)", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

/** Strip to digits and drop a leading 1 country code if present. Returns up to 10 NANP digits. */
function nanpDigits(input: string): string {
  let d = input.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  return d.slice(0, 10);
}

/** Format NANP digits as (XXX) XXX-XXXX progressively. */
function formatNanp(input: string): string {
  const d = nanpDigits(input);
  if (d.length === 0) return "";
  if (d.length < 4) return `(${d}`;
  if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

/** Validate NANP: 10 digits, area code & exchange must start with 2-9. */
function isValidNanp(input: string): boolean {
  const d = nanpDigits(input);
  return d.length === 10 && /^[2-9]\d{2}[2-9]\d{6}$/.test(d);
}

function toE164Nanp(input: string): string {
  return `+1${nanpDigits(input)}`;
}

const SignUp = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("code");
  const [inviteCode, setInviteCode] = useState("");
  const [validating, setValidating] = useState(false);
  const [role, setRole] = useState<string>("");
  const [prefilled, setPrefilled] = useState({ first_name: false, last_name: false, email: false });
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone_display: "",
    password: "",
    confirm_password: "",
  });
  const [agreed, setAgreed] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  // Verify step
  const [otp, setOtp] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  const passedRules = PW_RULES.filter((r) => r.test(form.password));
  const passwordStrong = passedRules.length === PW_RULES.length;
  const passwordsMatch = form.password.length > 0 && form.password === form.confirm_password;
  const phoneValid = isValidNanp(form.phone_display);
  const phoneE164 = toE164Nanp(form.phone_display);
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());

  async function onValidateCode(e: React.FormEvent) {
    e.preventDefault();
    setValidating(true);
    const code = inviteCode.trim().toUpperCase();
    const { data, error } = await supabase.functions.invoke("validate-invite", {
      body: { invite_code: code },
    });
    setValidating(false);

    if (error) {
      toast.error("We couldn't verify your code right now. Please try again.");
      return;
    }
    if (data && (data as { error?: string }).error) {
      toast.error((data as { error?: string }).error!);
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
    setPrefilled({
      first_name: !!invite.first_name,
      last_name: !!invite.last_name,
      email: !!invite.email,
    });
    setInviteCode(code);
    setStep("details");
    toast.success("Invite verified. Complete your profile to continue.");
  }

  async function onSubmitDetails(e: React.FormEvent) {
    e.preventDefault();
    if (!emailValid) { toast.error("Enter a valid email address"); return; }
    if (!phoneValid) { toast.error("Enter a valid US or Canada mobile number"); return; }
    if (!passwordStrong) { toast.error("Password doesn't meet all requirements"); return; }
    if (!passwordsMatch) { toast.error("Passwords don't match"); return; }
    if (!agreed) { toast.error("Please agree to the Terms and Privacy Policy"); return; }

    setLoading(true);
    const { data, error } = await supabase.functions.invoke("signup-with-invite", {
      body: {
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        phone_e164: phoneE164,
        password: form.password,
        invite_code: inviteCode,
      },
    });
    if (error) {
      toast.error("We couldn't create your account right now. Please try again.");
      setLoading(false);
      return;
    }
    if (data && (data as { error?: string }).error) {
      toast.error((data as { error?: string }).error!);
      setLoading(false);
      return;
    }
    const { error: signErr } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    });
    setLoading(false);
    if (signErr) { toast.error(signErr.message); return; }

    toast.success("Account created");
    navigate("/");
  }

  async function onVerifyOtp() {
    if (otp.length !== 6) return;
    setVerifying(true);
    const { data, error } = await supabase.functions.invoke("verify-sms-otp", {
      body: { code: otp, device_id: getDeviceId() },
    });
    setVerifying(false);
    if (error || (data && (data as { error?: string }).error)) {
      toast.error((data as { error?: string })?.error || error?.message || "Verification failed");
      return;
    }
    toast.success("Account created");
    navigate("/");
  }

  async function onResendOtp() {
    setResending(true);
    const { error } = await supabase.functions.invoke("send-sms-otp");
    setResending(false);
    if (error) toast.error(error.message);
    else toast.success("New code sent");
  }

  const phoneTail = phoneE164.slice(-4);
  const phoneMasked = phoneValid
    ? `+1 (•••) •••-${phoneTail}`
    : "";

  const subtitle =
    step === "code"
      ? "LeaseLoft™ is invite-only. Enter the code you received to begin."
      : step === "details"
      ? "Invite verified. Complete your profile to create your account."
      : `We sent a 6-digit code to ${phoneMasked}. Enter it below to activate two-factor authentication and finish creating your account.`;

  const title = step === "verify" ? "Verify your phone" : "Join LeaseLoft™";

  return (
    <AuthLayout
      title={title}
      subtitle={subtitle}
      footer={
        step === "verify" ? null : (
          <>
            Already have an account?{" "}
            <Link to="/signin" className="text-primary font-medium hover:underline">Sign in</Link>
          </>
        )
      }
    >
      {step === "code" && (
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
          <p className="text-center text-sm text-muted-foreground pt-2">
            Don't have a code?{" "}
            <Link to="/request-invite" className="text-primary font-medium hover:underline">
              Request one
            </Link>
          </p>
        </form>
      )}

      {step === "details" && (
        <form onSubmit={onSubmitDetails} className="space-y-4">
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
                onClick={() => {
                  setStep("code");
                  setRole("");
                  setInviteCode("");
                  setForm({
                    first_name: "",
                    last_name: "",
                    email: "",
                    phone_display: "",
                    password: "",
                    confirm_password: "",
                  });
                  setPrefilled({ first_name: false, last_name: false, email: false });
                  setAgreed(false);
                  setShowPw(false);
                  setShowConfirm(false);
                }}
              >
                Change
              </Button>
            </div>
          </div>

          <div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="first">First name</Label>
                <Input
                  id="first"
                  required
                  value={form.first_name}
                  onChange={(e) => set("first_name", e.target.value)}
                  readOnly={prefilled.first_name}
                  className={prefilled.first_name ? "bg-muted/50 cursor-not-allowed" : ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last">Last name</Label>
                <Input
                  id="last"
                  required
                  value={form.last_name}
                  onChange={(e) => set("last_name", e.target.value)}
                  readOnly={prefilled.last_name}
                  className={prefilled.last_name ? "bg-muted/50 cursor-not-allowed" : ""}
                />
              </div>
            </div>
            {(prefilled.first_name || prefilled.last_name) && (
              <p className="text-xs text-muted-foreground mt-2">
                Your name was pre-filled from the invite and can't be changed. Contact whoever invited you if anything is incorrect.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              readOnly={prefilled.email}
              className={prefilled.email ? "bg-muted/50 cursor-not-allowed" : ""}
              aria-invalid={!prefilled.email && form.email.length > 0 && !emailValid}
            />
            {prefilled.email ? (
              <p className="text-xs text-muted-foreground">
                This invite was sent to a specific email and can't be changed.
              </p>
            ) : (
              form.email.length > 0 && !emailValid && (
                <p className="text-xs text-destructive">Enter a valid email address.</p>
              )
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Mobile phone</Label>
            <div className="flex gap-2">
              <div className="flex h-10 items-center rounded-md border border-input bg-muted/50 px-3 text-sm text-muted-foreground">
                🇺🇸/🇨🇦 +1
              </div>
              <Input
                id="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                placeholder="(555) 867-5310"
                required
                value={form.phone_display}
                onChange={(e) => set("phone_display", formatNanp(e.target.value))}
                aria-invalid={form.phone_display.length > 0 && !phoneValid}
              />
            </div>
            {form.phone_display.length > 0 && !phoneValid && (
              <p className="text-xs text-destructive">
                Enter a valid 10-digit US or Canada mobile number.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              US/Canada numbers only. Standard SMS rates may apply. We'll send a verification code next.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPw ? "text" : "password"}
                required
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                aria-label={showPw ? "Hide password" : "Show password"}
                tabIndex={-1}
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {form.password.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs">
                {PW_RULES.map((r) => {
                  const ok = r.test(form.password);
                  return (
                    <li key={r.id} className={`flex items-center gap-2 ${ok ? "text-primary" : "text-muted-foreground"}`}>
                      {ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                      {r.label}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm">Confirm password</Label>
            <div className="relative">
              <Input
                id="confirm"
                type={showConfirm ? "text" : "password"}
                required
                value={form.confirm_password}
                onChange={(e) => set("confirm_password", e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                aria-label={showConfirm ? "Hide password" : "Show password"}
                tabIndex={-1}
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {form.confirm_password.length > 0 && !passwordsMatch && (
              <p className="text-xs text-destructive">Passwords don't match.</p>
            )}
          </div>

          <label
            htmlFor="terms"
            className="flex items-start gap-3 rounded-md border bg-card p-3 cursor-pointer hover:bg-muted/30 transition-colors"
          >
            <Checkbox
              id="terms"
              checked={agreed}
              onCheckedChange={(v) => setAgreed(v === true)}
              className="mt-0.5"
            />
            <div className="text-sm leading-tight">
              <div className="font-medium">
                I agree to the{" "}
                <Link to="/terms" className="text-primary hover:underline">Terms of Service</Link>
                {" "}and{" "}
                <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                I consent to receive SMS codes for two-factor authentication at the number above.
              </div>
            </div>
          </label>

          <Button
            type="submit"
            className="w-full"
            disabled={loading || !emailValid || !phoneValid || !passwordStrong || !passwordsMatch || !agreed}
          >
            {loading ? "Creating account…" : "Create account"}
          </Button>
        </form>
      )}

      {step === "verify" && (
        <div className="space-y-6">
          <div className="flex justify-center">
            <InputOTP maxLength={6} value={otp} onChange={setOtp} autoFocus>
              <InputOTPGroup>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <InputOTPSlot key={i} index={i} className="w-12 h-12 text-lg" />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>
          <div className="text-center text-sm text-muted-foreground">
            Didn't receive it?{" "}
            <button
              onClick={onResendOtp}
              disabled={resending}
              className="text-foreground font-medium underline underline-offset-2 hover:text-primary disabled:opacity-50"
            >
              {resending ? "Sending…" : "Resend code"}
            </button>
          </div>
          <Button
            onClick={onVerifyOtp}
            className="w-full"
            disabled={verifying || otp.length !== 6}
          >
            {verifying ? "Verifying…" : "Verify & create account"}
          </Button>
          <div className="border-t pt-4 text-center text-sm text-muted-foreground">
            Wrong number?{" "}
            <button
              onClick={() => setStep("details")}
              className="text-foreground font-medium underline underline-offset-2 hover:text-primary"
            >
              Edit registration
            </button>
          </div>
        </div>
      )}
    </AuthLayout>
  );
};

export default SignUp;
