import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { supabase } from "@/integrations/supabase/client";
import { getDeviceId } from "@/lib/device";
import { toast } from "sonner";

const Verify2FA = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const fromPath = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || "/";
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [phoneTail, setPhoneTail] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) { navigate("/signin"); return; }
      const { data: profile } = await supabase
        .from("profiles")
        .select("phone_e164")
        .eq("id", data.session.user.id)
        .maybeSingle();
      if (profile?.phone_e164) setPhoneTail(profile.phone_e164.slice(-4));
    })();
  }, [navigate]);

  async function onVerify() {
    if (code.length !== 6) return;
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("verify-sms-otp", {
      body: { code, device_id: getDeviceId() },
    });
    setLoading(false);
    if (error || (data && (data as { error?: string }).error)) {
      toast.error((data as { error?: string })?.error || error?.message || "Verification failed");
      return;
    }
    toast.success("Verified");
    navigate("/");
  }

  async function onResend() {
    setResending(true);
    const { error } = await supabase.functions.invoke("send-sms-otp");
    setResending(false);
    if (error) toast.error(error.message);
    else toast.success("New code sent");
  }

  return (
    <AuthLayout
      title="Two-factor authentication"
      subtitle={
        phoneTail
          ? `We sent a 6-digit code to the phone ending in ••${phoneTail}.`
          : "Enter the 6-digit code we sent to your phone."
      }
    >
      <div className="space-y-6">
        <div className="flex justify-center">
          <InputOTP maxLength={6} value={code} onChange={setCode}>
            <InputOTPGroup>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <InputOTPSlot key={i} index={i} className="w-12 h-12 text-lg" />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>
        <Button onClick={onVerify} className="w-full" disabled={loading || code.length !== 6}>
          {loading ? "Verifying…" : "Verify"}
        </Button>
        <div className="text-center text-sm text-muted-foreground">
          Didn't receive it?{" "}
          <button onClick={onResend} disabled={resending} className="text-primary hover:underline disabled:opacity-50">
            {resending ? "Sending…" : "Resend code"}
          </button>
        </div>
      </div>
    </AuthLayout>
  );
};

export default Verify2FA;
