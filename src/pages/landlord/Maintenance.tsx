import { useEffect, useState } from "react";
import { Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LandlordLayout } from "@/components/layout/LandlordLayout";
import { StatusPill } from "@/components/layout/StatusPill";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { initials, monthDay } from "@/lib/format";

interface Item {
  id: string;
  ref: string;
  tenant: string;
  unit: string;
  title: string;
  priority: string;
  date: string;
  status: "open" | "in_progress" | "resolved" | "closed";
}

const statusTone = { open: "warning", in_progress: "info", resolved: "success", closed: "muted" } as const;
const statusLabel = { open: "Open", in_progress: "In progress", resolved: "Resolved", closed: "Closed" } as const;

export default function LandlordMaintenance() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data: s } = await supabase.auth.getSession();
    if (!s.session) return;
    const uid = s.session.user.id;

    const { data: leases } = await supabase.from("leases").select("id,tenant_id,unit_id").eq("landlord_id", uid);
    const leaseIds = (leases ?? []).map(l => l.id);
    if (leaseIds.length === 0) { setItems([]); setLoading(false); return; }

    const [{ data: maint }, { data: units }, { data: props }, { data: profs }] = await Promise.all([
      supabase.from("maintenance_requests").select("*").in("lease_id", leaseIds).order("created_at", { ascending: false }),
      supabase.from("units").select("id,label,property_id"),
      supabase.from("properties").select("id,name"),
      supabase.from("profiles").select("id,full_name,first_name,last_name,email").in("id", Array.from(new Set((leases ?? []).map(l => l.tenant_id)))),
    ]);

    const leaseById = new Map((leases ?? []).map(l => [l.id, l]));
    const unitById = new Map((units ?? []).map(u => [u.id, u]));
    const propById = new Map((props ?? []).map(p => [p.id, p]));
    const profById = new Map((profs ?? []).map(p => [p.id, p.full_name || `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || p.email]));

    setItems((maint ?? []).map((m, i) => {
      const lease = leaseById.get(m.lease_id);
      const unit = lease ? unitById.get(lease.unit_id) : undefined;
      const prop = unit ? propById.get(unit.property_id) : undefined;
      return {
        id: m.id,
        ref: `m-${String(100 + i).padStart(3, "0")}`,
        tenant: profById.get(lease?.tenant_id ?? "") ?? "Tenant",
        unit: `${prop?.name ?? "—"} · ${unit?.label ?? ""}`,
        title: m.title,
        priority: m.priority,
        date: m.created_at,
        status: m.status,
      };
    }));
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function update(id: string, status: Item["status"]) {
    const patch: any = { status };
    if (status === "resolved") patch.resolved_at = new Date().toISOString();
    const { error } = await supabase.from("maintenance_requests").update(patch).eq("id", id);
    if (error) return toast({ title: "Update failed", description: error.message, variant: "destructive" });

    // Notify tenant (best-effort, non-blocking)
    try {
      const { data: m } = await supabase
        .from("maintenance_requests")
        .select("title, lease_id")
        .eq("id", id)
        .maybeSingle();
      if (m?.lease_id) {
        const { data: lease } = await supabase
          .from("leases")
          .select("tenant_id, unit_id")
          .eq("id", m.lease_id)
          .maybeSingle();
        if (lease?.tenant_id) {
          const { data: tenantProf } = await supabase
            .from("profiles")
            .select("email, full_name, first_name")
            .eq("id", lease.tenant_id)
            .maybeSingle();
          const { data: unit } = await supabase
            .from("units")
            .select("label, property_id")
            .eq("id", lease.unit_id)
            .maybeSingle();
          const { data: prop } = unit?.property_id
            ? await supabase.from("properties").select("name").eq("id", unit.property_id).maybeSingle()
            : { data: null as any };
          if (tenantProf?.email) {
            const tenantName = tenantProf.full_name || tenantProf.first_name || "";
            await supabase.functions.invoke("send-transactional-email", {
              body: {
                templateName: "maintenance-request-updated",
                recipientEmail: tenantProf.email,
                idempotencyKey: `maint-updated-${id}-${status}`,
                templateData: {
                  tenantName,
                  title: m.title,
                  newStatus: status,
                  propertyName: prop?.name ?? "",
                  unitLabel: unit?.label ?? "",
                },
              },
            });
          }
        }
      }
    } catch (e) {
      console.error("notify tenant failed", e);
    }

    toast({ title: "Status updated" });
    load();
  }


  return (
    <LandlordLayout crumbs={["Maintenance"]}>
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">Maintenance</h1>
      <p className="text-muted-foreground mt-1.5 text-sm">{items.filter(i => i.status === "open").length} open · {items.filter(i => i.status === "in_progress").length} in progress</p>

      <div className="rounded-xl border border-border bg-card mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              <th className="text-left font-medium px-6 py-4">Ref</th>
              <th className="text-left font-medium px-6 py-4">Tenant</th>
              <th className="text-left font-medium px-6 py-4">Issue</th>
              <th className="text-left font-medium px-6 py-4">Unit</th>
              <th className="text-left font-medium px-6 py-4">Priority</th>
              <th className="text-left font-medium px-6 py-4">Submitted</th>
              <th className="text-left font-medium px-6 py-4">Status</th>
              <th className="text-left font-medium px-6 py-4">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">Loading…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={8} className="px-6 py-16 text-center text-muted-foreground"><Wrench className="w-8 h-8 mx-auto mb-2 opacity-40" />No maintenance requests yet.</td></tr>
            ) : items.map(it => (
              <tr key={it.id} className="border-t border-border">
                <td className="px-6 py-4 font-mono text-xs text-muted-foreground">{it.ref}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-muted text-foreground grid place-items-center text-[10px] font-semibold">{initials(it.tenant)}</div>
                    <span className="font-medium text-foreground">{it.tenant}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-foreground">{it.title}</td>
                <td className="px-6 py-4 text-muted-foreground">{it.unit}</td>
                <td className="px-6 py-4">
                  <StatusPill tone={it.priority === "urgent" || it.priority === "high" ? "danger" : it.priority === "medium" ? "warning" : "muted"} dot={false}>
                    {it.priority[0].toUpperCase() + it.priority.slice(1)}
                  </StatusPill>
                </td>
                <td className="px-6 py-4 text-muted-foreground">{monthDay(it.date)}</td>
                <td className="px-6 py-4"><StatusPill tone={statusTone[it.status]}>{statusLabel[it.status]}</StatusPill></td>
                <td className="px-6 py-4">
                  <Select value={it.status} onValueChange={v => update(it.id, v as Item["status"])}>
                    <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="in_progress">In progress</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </LandlordLayout>
  );
}
