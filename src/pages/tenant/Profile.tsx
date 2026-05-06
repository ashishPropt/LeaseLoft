import { useEffect, useState } from "react";
import { TenantLayout } from "@/components/layout/TenantLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { initials } from "@/lib/format";
import { Switch } from "@/components/ui/switch";

export default function TenantProfile() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ first_name: "", last_name: "", phone_e164: "", email: "" });
  const [sms2fa, setSms2fa] = useState(false);
  const [savingMfa, setSavingMfa] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) return;
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
    })();
  }, []);

  async function toggle2fa(next: boolean) {
    if (next && !form.phone_e164) {
      toast({ title: "Add a phone number first", description: "We need a phone to send verification codes.", variant: "destructive" });
      return;
    }
    setSavingMfa(true);
    const { data: s } = await supabase.auth.getSession();
    if (!s.session) { setSavingMfa(false); return; }
    const { error } = await supabase.from("profiles").update({
      sms_2fa_consent: next,
      sms_2fa_consent_at: next ? new Date().toISOString() : null,
      sms_2fa_consent_source: next ? "profile_page" : null,
    }).eq("id", s.session.user.id);
    setSavingMfa(false);
    if (error) return toast({ title: "Could not update 2FA", description: error.message, variant: "destructive" });
    setSms2fa(next);
    toast({ title: next ? "Two-factor authentication enabled" : "Two-factor authentication disabled" });
  }

  async function save() {
    setSaving(true);
    const { data: s } = await supabase.auth.getSession();
    if (!s.session) { setSaving(false); return; }
    const fullName = `${form.first_name} ${form.last_name}`.trim();
    const { error } = await supabase.from("profiles").update({
      first_name: form.first_name || null,
      last_name: form.last_name || null,
      full_name: fullName || null,
      phone_e164: form.phone_e164 || null,
    }).eq("id", s.session.user.id);
    setSaving(false);
    if (error) return toast({ title: "Could not save", description: error.message, variant: "destructive" });
    toast({ title: "Profile updated" });
  }

  const name = `${form.first_name} ${form.last_name}`.trim() || form.email || "Tenant";

  return (
    <TenantLayout crumbs={["Profile"]}>
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">Profile</h1>
      <p className="text-muted-foreground mt-1.5 text-sm">Manage your personal information.</p>

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
                <p className="text-xs text-muted-foreground mt-1.5">Contact your landlord to change your email.</p>
              </div>
              <div>
                <Label>Phone</Label>
                <Input placeholder="+1 555 123 4567" value={form.phone_e164} onChange={e => setForm({ ...form, phone_e164: e.target.value })} />
              </div>
              <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
            </div>
          )}
        </div>

      </div>
    </TenantLayout>
  );
}
