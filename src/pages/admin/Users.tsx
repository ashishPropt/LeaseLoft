import { useEffect, useState } from "react";
import { Search, Shield, ShieldCheck, ShieldOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { StatusPill } from "@/components/layout/StatusPill";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { initials, shortDate } from "@/lib/format";

type Role = "admin" | "landlord" | "tenant";

interface UserRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  created_at: string;
  roles: Role[];
  subscription_price_id: string | null;
  stripe_subscription_status: string | null;
}

const roleTone: Record<Role, "success" | "info" | "muted"> = {
  admin: "info",
  landlord: "success",
  tenant: "muted",
};

export default function AdminUsers() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | Role>("all");

  async function load() {
    setLoading(true);
    const [{ data: profs }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("id,full_name,first_name,last_name,email,phone_e164,created_at,subscription_price_id,stripe_subscription_status"),
      supabase.from("user_roles").select("user_id,role"),
    ]);
    const rolesByUser = new Map<string, Role[]>();
    (roles ?? []).forEach((r: any) => {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role);
      rolesByUser.set(r.user_id, arr);
    });
    setRows((profs ?? []).map((p: any) => ({
      id: p.id,
      name: p.full_name || `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || p.email,
      email: p.email,
      phone: p.phone_e164,
      created_at: p.created_at,
      roles: rolesByUser.get(p.id) ?? [],
      subscription_price_id: p.subscription_price_id,
      stripe_subscription_status: p.stripe_subscription_status,
    })).sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)));
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function savePriceId(userId: string, priceId: string) {
    const value = priceId.trim() || null;
    const { error } = await supabase.from("profiles").update({ subscription_price_id: value }).eq("id", userId);
    if (error) return toast({ title: "Could not save price ID", description: error.message, variant: "destructive" });
    toast({ title: value ? "Plan price ID saved" : "Plan price ID cleared" });
    load();
  }

  async function assign(userId: string, role: Role) {
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
    if (error && !error.message.includes("duplicate")) {
      return toast({ title: "Could not assign role", description: error.message, variant: "destructive" });
    }
    toast({ title: `Assigned ${role}` });
    load();
  }

  async function revoke(userId: string, role: Role) {
    const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role);
    if (error) return toast({ title: "Could not revoke role", description: error.message, variant: "destructive" });
    toast({ title: `Revoked ${role}` });
    load();
  }

  const filtered = rows.filter(r => {
    if (filter !== "all" && !r.roles.includes(filter)) return false;
    if (q && !`${r.name} ${r.email}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <AdminLayout crumbs={["Users"]}>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Users</h1>
          <p className="text-muted-foreground mt-1.5 text-sm">{rows.length} accounts · manage roles and access.</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mt-6">
        <div className="relative flex-1 min-w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search name or email" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <Select value={filter} onValueChange={v => setFilter(v as any)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            <SelectItem value="admin">Admins</SelectItem>
            <SelectItem value="landlord">Landlords</SelectItem>
            <SelectItem value="tenant">Tenants</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border border-border bg-card mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              <th className="text-left font-medium px-6 py-4">User</th>
              <th className="text-left font-medium px-6 py-4">Email</th>
              <th className="text-left font-medium px-6 py-4">Phone</th>
              <th className="text-left font-medium px-6 py-4">Joined</th>
              <th className="text-left font-medium px-6 py-4">Roles</th>
              <th className="text-right font-medium px-6 py-4">Manage roles</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">No users match.</td></tr>
            ) : filtered.map(u => (
              <tr key={u.id} className="border-t border-border align-top">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-muted text-foreground grid place-items-center text-xs font-semibold">{initials(u.name)}</div>
                    <span className="font-medium text-foreground">{u.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-muted-foreground">{u.email}</td>
                <td className="px-6 py-4 text-muted-foreground">{u.phone ?? "—"}</td>
                <td className="px-6 py-4 text-muted-foreground">{shortDate(u.created_at)}</td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1.5">
                    {u.roles.length === 0 && <span className="text-muted-foreground text-xs">No role</span>}
                    {u.roles.map(r => (
                      <StatusPill key={r} tone={roleTone[r]}>{r}</StatusPill>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {(["admin","landlord","tenant"] as Role[]).map(r => {
                      const has = u.roles.includes(r);
                      return (
                        <Button
                          key={r}
                          size="sm"
                          variant={has ? "outline" : "ghost"}
                          className="h-7 px-2 text-xs"
                          onClick={() => has ? revoke(u.id, r) : assign(u.id, r)}
                        >
                          {has ? <ShieldOff className="w-3 h-3 mr-1" /> : <ShieldCheck className="w-3 h-3 mr-1" />}
                          {has ? `Revoke ${r}` : `+ ${r}`}
                        </Button>
                      );
                    })}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}
