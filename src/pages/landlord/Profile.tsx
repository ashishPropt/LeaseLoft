import { useEffect, useState, useCallback } from "react";
import { LandlordLayout } from "@/components/layout/LandlordLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { initials } from "@/lib/format";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Landmark, ExternalLink, RefreshCw, Unlink } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface ConnectStatus {
  connected: boolean;
  account_id?: string;
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
  details_submitted?: boolean;
  login_url?: string;
}

export default function LandlordProfile() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ first_name: "", last_name: "", phone_e164: "", email: "" });
  const [sms2fa, setSms2fa] = useState(false);
  const [savingMfa, setSavingMfa] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [connect, setConnect] = useState<ConnectStatus | null>(null);
  const [connectLoading, setConnectLoading] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const refreshConnect = useCallback(async (withLogin = false) => {
    setConnectLoading(true);
    const { data, error } = await supabase.functions.invoke(
      `stripe-connect-status${withLogin ? "?login_link=1" : ""}`,
      { method: "GET" },
    );
    setConnectLoading(false);
    if (error) {
      toast({ title: "Could not load Stripe status", description: error.message, variant: "destructive" });
      return;
    }
    setConnect(data as ConnectStatus);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) return;
      setUserId(s.session.user.id);
      const { data: p } = await supabase
        .from("profiles")
        .select("first_name,last_name,email,phone_e164,sms_2fa_consent")
        .eq("id", s.session.user.id).maybeSingle();
      if (p) {
        setForm({
          first_name: p.first_name ?? "", last_name: p.last_name ?? "",
          phone_e164: p.phone_e164 ?? "", email: p.email ?? "",
        });
        setSms2fa(!!p.sms_2fa_consent);
      }
      setLoading(false);
      refreshConnect();
    })();
  }, [refreshConnect]);

  // After returning from Stripe, refresh status and clean URL.
  useEffect(() => {
    if (searchParams.get("stripe_return") || searchParams.get("stripe_refresh")) {
      refreshConnect();
      const next = new URLSearchParams(searchParams);
      next.delete("stripe_return"); next.delete("stripe_refresh");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams, refreshConnect]);

  const [manualAcct, setManualAcct] = useState("");

  async function startOnboarding(accountId?: string) {
    setConnectLoading(true);
    const { data, error } = await supabase.functions.invoke("stripe-connect-onboard", {
      body: {
        return_url_origin: window.location.origin,
        ...(accountId ? { account_id: accountId } : {}),
      },
    });
    setConnectLoading(false);
    if (error) {
      toast({ title: "Could not start Stripe onboarding", description: error?.message, variant: "destructive" });
      return;
    }
    if (data?.url) {
      window.location.href = data.url as string;
      return;
    }
    if (data?.attached) {
      toast({ title: "Test account attached" });
      setManualAcct("");
      refreshConnect();
    }
  }

  async function openDashboard() {
    await refreshConnect(true);
    if (connect?.login_url) window.open(connect.login_url, "_blank");
  }

  async function disconnect() {
    setConnectLoading(true);
    const { error } = await supabase.functions.invoke("stripe-connect-disconnect", { method: "POST" });
    setConnectLoading(false);
    if (error) {
      toast({ title: "Could not disconnect", description: error.message, variant: "destructive" });
      return;
    }
    setConnect({ connected: false });
    toast({ title: "Stripe account disconnected" });
  }

  async function toggle2fa(next: boolean) {
    if (!userId) return;
    if (next && !form.phone_e164) {
      toast({ title: "Add a phone number first", variant: "destructive" });
      return;
    }
    setSavingMfa(true);
    const { error } = await supabase.from("profiles").update({
      sms_2fa_consent: next,
      sms_2fa_consent_at: next ? new Date().toISOString() : null,
      sms_2fa_consent_source: next ? "profile_page" : null,
    }).eq("id", userId);
    setSavingMfa(false);
    if (error) return toast({ title: "Could not update 2FA", description: error.message, variant: "destructive" });
    setSms2fa(next);
    toast({ title: next ? "Two-factor authentication enabled" : "Two-factor authentication disabled" });
  }

  async function save() {
    if (!userId) return;
    setSaving(true);
    const fullName = `${form.first_name} ${form.last_name}`.trim();
    const { error } = await supabase.from("profiles").update({
      first_name: form.first_name || null,
      last_name: form.last_name || null,
      full_name: fullName || null,
      phone_e164: form.phone_e164 || null,
    }).eq("id", userId);
    setSaving(false);
    if (error) return toast({ title: "Could not save", description: error.message, variant: "destructive" });
    toast({ title: "Profile updated" });
  }

  const name = `${form.first_name} ${form.last_name}`.trim() || form.email || "Landlord";

  const fullyOnboarded = !!connect?.charges_enabled && !!connect?.payouts_enabled;
  const partial = !!connect?.connected && !fullyOnboarded;

  return (
    <LandlordLayout crumbs={["Profile"]}>
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">Profile</h1>
      <p className="text-muted-foreground mt-1.5 text-sm">Manage your information and payouts.</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-8">
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-muted text-foreground grid place-items-center text-lg font-semibold">{initials(name)}</div>
            <div className="min-w-0">
              <div className="font-semibold text-foreground truncate">{name}</div>
              <div className="text-sm text-muted-foreground truncate">{form.email}</div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-6">
          <h2 className="font-semibold text-foreground">Personal information</h2>
          {loading ? (
            <div className="text-muted-foreground mt-4">Loading…</div>
          ) : (
            <div className="space-y-4 mt-5 max-w-lg">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>First name</Label>
                  <Input value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} />
                </div>
                <div>
                  <Label>Last name</Label>
                  <Input value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Email</Label>
                <Input value={form.email} disabled />
              </div>
              <div>
                <Label>Phone</Label>
                <Input placeholder="+1 555 123 4567" value={form.phone_e164} onChange={e => setForm({ ...form, phone_e164: e.target.value })} />
              </div>
              <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
            </div>
          )}
        </div>

        <div className="lg:col-span-3 rounded-xl border border-border bg-card p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Landmark className="w-4 h-4 text-muted-foreground" />
                <h2 className="font-semibold text-foreground">Payouts (Stripe Connect)</h2>
                {fullyOnboarded && <Badge variant="secondary">Active</Badge>}
                {partial && <Badge variant="outline">Action required</Badge>}
                {!connect?.connected && !connectLoading && <Badge variant="outline">Not connected</Badge>}
              </div>
              <p className="text-sm text-muted-foreground mt-1 max-w-xl">
                Connect a Stripe account to receive rent payouts directly to your bank. Stripe handles identity verification and payouts; you can manage everything from your Stripe dashboard.
              </p>
              {connect?.connected && (
                <div className="text-xs text-muted-foreground mt-2 space-y-0.5">
                  <div>Charges enabled: <span className="text-foreground">{connect.charges_enabled ? "Yes" : "No"}</span></div>
                  <div>Payouts enabled: <span className="text-foreground">{connect.payouts_enabled ? "Yes" : "No"}</span></div>
                  <div>Details submitted: <span className="text-foreground">{connect.details_submitted ? "Yes" : "No"}</span></div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => refreshConnect()} disabled={connectLoading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${connectLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              {!connect?.connected || partial ? (
                <Button onClick={() => startOnboarding()} disabled={connectLoading}>
                  {connect?.connected ? "Continue onboarding" : "Connect with Stripe"}
                </Button>
              ) : (
                <Button variant="outline" onClick={openDashboard} disabled={connectLoading}>
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Stripe dashboard
                </Button>
              )}
              {connect?.connected && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" disabled={connectLoading}>
                      <Unlink className="w-4 h-4 mr-2" />
                      Disconnect
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Disconnect Stripe account?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Future tenant payments will not be transferred to your bank until you reconnect a Stripe account. This does not close your Stripe account — you can manage or close it from your Stripe dashboard.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={disconnect}>Disconnect</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>

          <div className="mt-5 pt-5 border-t border-border">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Testing: attach existing Stripe account</Label>
            <p className="text-xs text-muted-foreground mt-1">
              Paste a Stripe test connected account ID (e.g. <code className="font-mono">acct_1ABC…</code>) created in your Stripe test dashboard. Skips onboarding if the account already has details submitted.
            </p>
            <div className="flex gap-2 mt-2 max-w-lg">
              <Input
                placeholder="acct_1ABC..."
                value={manualAcct}
                onChange={(e) => setManualAcct(e.target.value)}
                className="font-mono text-sm"
              />
              <Button
                variant="outline"
                onClick={() => startOnboarding(manualAcct.trim())}
                disabled={connectLoading || !manualAcct.trim()}
              >
                Attach
              </Button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-3 rounded-xl border border-border bg-card p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="font-semibold text-foreground">Two-factor authentication</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Receive a one-time code via SMS when signing in. Requires a verified phone number on file.
              </p>
            </div>
            <Switch checked={sms2fa} disabled={savingMfa || loading} onCheckedChange={toggle2fa} />
          </div>
        </div>
      </div>
    </LandlordLayout>
  );
}
