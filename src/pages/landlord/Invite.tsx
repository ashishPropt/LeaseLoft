import { useEffect, useState } from "react";
import { Copy, Check, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LandlordLayout } from "@/components/layout/LandlordLayout";
import { StatusPill } from "@/components/layout/StatusPill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { shortDate } from "@/lib/format";

interface Invite {
  code: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  property: string | null;
  used_count: number;
  max_uses: number;
  expires_at: string | null;
  created_at: string;
}

function makeCode() {
  const r = Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
  return `TN-2026-${r}`;
}

interface Property { id: string; name: string; address: string | null }
interface Unit { id: string; label: string; property_id: string }

export default function LandlordInvite() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", property_id: "", unit_id: "", note: "" });
  const [creatorName, setCreatorName] = useState<string>("");
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);

  async function load() {
    const { data: s } = await supabase.auth.getSession();
    if (!s.session) return;
    const uid = s.session.user.id;
    const { data: prof } = await supabase.from("profiles").select("full_name,first_name,last_name").eq("id", uid).maybeSingle();
    setCreatorName(prof?.full_name || `${prof?.first_name ?? ""} ${prof?.last_name ?? ""}`.trim() || "Landlord");

    const [invitesRes, propsRes] = await Promise.all([
      supabase
        .from("invite_codes")
        .select("code,email,first_name,last_name,property,used_count,max_uses,expires_at,created_at")
        .eq("role", "tenant")
        .eq("created_by", uid)
        .order("created_at", { ascending: false }),
      supabase.from("properties").select("id,name,address").eq("owner_id", uid).order("name"),
    ]);
    setInvites(invitesRes.data ?? []);
    setProperties(propsRes.data ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!form.property_id) { setUnits([]); return; }
    supabase.from("units").select("id,label,property_id").eq("property_id", form.property_id).order("label")
      .then(({ data }) => setUnits(data ?? []));
  }, [form.property_id]);

  async function createInvite() {
    if (!form.first_name || !form.email) {
      toast({ title: "Name and email are required", variant: "destructive" });
      return;
    }
    setCreating(true);
    const code = makeCode();
    const { data: s } = await supabase.auth.getSession();
    if (!s.session) { setCreating(false); return; }
    const prop = properties.find(p => p.id === form.property_id);
    const unit = units.find(u => u.id === form.unit_id);
    const propertyText = prop
      ? unit ? `${prop.name} · ${unit.label}` : prop.name
      : null;
    const { error } = await supabase.from("invite_codes").insert({
      code,
      role: "tenant",
      email: form.email,
      first_name: form.first_name,
      last_name: form.last_name || null,
      property: propertyText,
      note: form.note || null,
      created_by: s.session.user.id,
      created_by_name: creatorName,
      max_uses: 1,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });
    setCreating(false);
    if (error) return toast({ title: "Could not create invite", description: error.message, variant: "destructive" });
    toast({ title: "Invite created", description: `Code ${code} ready to share.` });
    setForm({ first_name: "", last_name: "", email: "", property_id: "", unit_id: "", note: "" });
    load();
  }

  async function copy(code: string) {
    await navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <LandlordLayout crumbs={["Invite Tenants"]}>
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">Invite tenants</h1>
      <p className="text-muted-foreground mt-1.5 text-sm">Generate a single-use invite code. Tenants enter it on the join screen to create their account.</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <div className="lg:col-span-1 rounded-xl border border-border bg-card p-6">
          <h2 className="font-semibold text-foreground">New invite</h2>
          <div className="space-y-4 mt-5">
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
              <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label>Property / unit (optional)</Label>
              <Input placeholder="e.g. 215 Maple Ave · 4B" value={form.property} onChange={e => setForm({ ...form, property: e.target.value })} />
            </div>
            <Button className="w-full" onClick={createInvite} disabled={creating}>
              <Plus className="w-4 h-4 mr-2" />{creating ? "Creating…" : "Create invite code"}
            </Button>
          </div>
        </div>

        <div className="lg:col-span-2 rounded-xl border border-border bg-card overflow-x-auto">
          <div className="px-6 py-5 border-b border-border">
            <h2 className="font-semibold text-foreground">Tenant invites</h2>
            <p className="text-xs text-muted-foreground mt-1">{invites.length} total</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                <th className="text-left font-medium px-6 py-3">Code</th>
                <th className="text-left font-medium px-6 py-3">For</th>
                <th className="text-left font-medium px-6 py-3">Status</th>
                <th className="text-left font-medium px-6 py-3">Expires</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">Loading…</td></tr>
              ) : invites.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">No invites yet.</td></tr>
              ) : invites.map(inv => {
                const used = inv.used_count >= inv.max_uses;
                const expired = inv.expires_at && new Date(inv.expires_at) < new Date();
                return (
                  <tr key={inv.code} className="border-t border-border">
                    <td className="px-6 py-3 font-mono text-foreground">{inv.code}</td>
                    <td className="px-6 py-3">
                      <div className="text-foreground">{[inv.first_name, inv.last_name].filter(Boolean).join(" ") || "—"}</div>
                      <div className="text-xs text-muted-foreground">{inv.email ?? ""}</div>
                    </td>
                    <td className="px-6 py-3">
                      <StatusPill tone={used ? "muted" : expired ? "danger" : "success"}>
                        {used ? "Used" : expired ? "Expired" : "Active"}
                      </StatusPill>
                    </td>
                    <td className="px-6 py-3 text-muted-foreground">{inv.expires_at ? shortDate(inv.expires_at) : "—"}</td>
                    <td className="px-6 py-3 text-right">
                      <Button variant="ghost" size="sm" onClick={() => copy(inv.code)}>
                        {copied === inv.code ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </LandlordLayout>
  );
}
