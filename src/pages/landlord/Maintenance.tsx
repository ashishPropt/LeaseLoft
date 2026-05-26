import { useEffect, useState } from "react";
import { Wrench, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LandlordLayout } from "@/components/layout/LandlordLayout";
import { StatusPill } from "@/components/layout/StatusPill";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { initials, monthDay } from "@/lib/format";
import { VendorPanel } from "@/components/maintenance/VendorPanel";

interface Item {
  id: string;
  ref: string;
  tenant: string;
  unit: string;
  title: string;
  description?: string | null;
  priority: string;
  date: string;
  status: "open" | "in_progress" | "resolved" | "closed" | "completed";
  // LeaseLoft context passed to Vendora for bid requests
  lease_id: string;
  landlord_id: string;
  property_name?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}

const statusTone = { open: "warning", in_progress: "info", resolved: "success", closed: "muted", completed: "success" } as const;
const statusLabel = { open: "Open", in_progress: "In progress", resolved: "Resolved", closed: "Closed", completed: "Completed" } as const;

export default function LandlordMaintenance() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [panelItem, setPanelItem] = useState<Item | null>(null);

  async function load() {
    const { data: s } = await supabase.auth.getSession();
    if (!s.session) return;
    const uid = s.session.user.id;

    const { data: leases } = await supabase.from("leases").select("id,tenant_id,unit_id,landlord_id").eq("landlord_id", uid);
    const leaseIds = (leases ?? []).map(l => l.id);
    if (leaseIds.length === 0) { setItems([]); setLoading(false); return; }

    const [{ data: maint }, { data: units }, { data: props }, { data: profs }] = await Promise.all([
      supabase.from("maintenance_requests").select("*").in("lease_id", leaseIds).order("created_at", { ascending: false }),
      supabase.from("units").select("id,label,property_id"),
      // Fetch city/state/zip for vendor geo-filtering
      supabase.from("properties").select("id,name,city,state,zip"),
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
        description: m.description,
        priority: m.priority,
        date: m.created_at,
        status: m.status,
        lease_id: m.lease_id,
        landlord_id: uid,
        property_name: prop?.name ?? null,
        city: prop?.city ?? null,
        state: prop?.state ?? null,
        zip: prop?.zip ?? null,
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
      <p className="text-muted-foreground mt-1.5 text-sm">
        {items.filter(i => i.status === "open").length} open · {items.filter(i => i.status === "in_progress").length} in progress · {items.filter(i => i.status === "completed").length} completed
      </p>
      {/* Completed requests are hidden from the active list — they appear in the count above */}

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
            ) : items.filter(i => i.status !== "completed").length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-16 text-center text-muted-foreground">
                  <Wrench className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  No active maintenance requests.
                </td>
              </tr>
            ) : items.filter(i => i.status !== "completed").map(it => (
              <tr key={it.id} className="border-t border-border">
                <td className="px-6 py-4 font-mono text-xs text-muted-foreground">{it.ref}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-muted text-foreground grid place-items-center text-[10px] font-semibold">{initials(it.tenant)}</div>
                    <span className="font-medium text-foreground">{it.tenant}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  {/* Clickable title → opens Vendora vendor panel */}
                  <button
                    onClick={() => setPanelItem(it)}
                    className="text-left text-foreground hover:text-primary hover:underline font-medium leading-snug"
                    title="Click to find vendors for this request"
                  >
                    {it.title}
                  </button>
                </td>
                <td className="px-6 py-4 text-muted-foreground">{it.unit}</td>
                <td className="px-6 py-4">
                  <StatusPill tone={it.priority === "urgent" || it.priority === "high" ? "danger" : it.priority === "medium" ? "warning" : "muted"} dot={false}>
                    {it.priority[0].toUpperCase() + it.priority.slice(1)}
                  </StatusPill>
                </td>
                <td className="px-6 py-4 text-muted-foreground">{monthDay(it.date)}</td>
                <td className="px-6 py-4"><StatusPill tone={statusTone[it.status]}>{statusLabel[it.status]}</StatusPill></td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <Select value={it.status} onValueChange={v => update(it.id, v as Item["status"])}>
                      <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="in_progress">In progress</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 px-2.5 gap-1.5 text-xs"
                      onClick={() => setPanelItem(it)}
                      title="Find vendors for this request"
                    >
                      <Building2 className="w-3.5 h-3.5" />
                      Vendors
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Vendora vendor recommendation panel */}
      <VendorPanel
        item={panelItem}
        open={panelItem !== null}
        onClose={() => setPanelItem(null)}
        onComplete={() => load()}
      />
    </LandlordLayout>
  );
}
