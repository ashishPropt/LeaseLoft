import { useEffect, useState } from "react";
import { TenantLayout } from "@/components/layout/TenantLayout";
import { useTenantContext } from "@/lib/useTenantContext";
import { LeaseDocuments } from "@/components/documents/LeaseDocuments";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface LeaseInfo {
  id: string;
  landlord_id: string;
  unit_id: string;
  start_date: string;
  end_date: string;
  status: string;
  unit_label?: string;
  landlord_name?: string | null;
}

export default function TenantDocuments() {
  const { ctx, loading: ctxLoading } = useTenantContext();
  const [leases, setLeases] = useState<LeaseInfo[]>([]);
  const [selectedLeaseId, setSelectedLeaseId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ctx?.userId) return;
    (async () => {
      const { data: leaseData } = await supabase
        .from("leases")
        .select("id,landlord_id,unit_id,start_date,end_date,status")
        .eq("tenant_id", ctx.userId)
        .order("start_date", { ascending: false });

      const leaseList = (leaseData ?? []) as LeaseInfo[];

      const unitIds = [...new Set(leaseList.map((l) => l.unit_id))];
      const landlordIds = [...new Set(leaseList.map((l) => l.landlord_id))];

      const [{ data: units }, { data: landlords }] = await Promise.all([
        supabase.from("units").select("id,label").in("id", unitIds),
        supabase
          .from("profiles")
          .select("id,full_name,first_name,last_name,email")
          .in("id", landlordIds),
      ]);

      const unitMap = new Map(units?.map((u) => [u.id, u.label]) ?? []);
      const landlordMap = new Map(
        landlords?.map((ll) => [
          ll.id,
          ll.full_name || `${ll.first_name ?? ""} ${ll.last_name ?? ""}`.trim() || ll.email,
        ]) ?? []
      );

      const enriched = leaseList.map((l) => ({
        ...l,
        unit_label: unitMap.get(l.unit_id),
        landlord_name: landlordMap.get(l.landlord_id) ?? "Landlord",
      }));

      setLeases(enriched);
      setSelectedLeaseId(ctx.lease?.id ?? enriched[0]?.id ?? null);
      setLoading(false);
    })();
  }, [ctx?.userId, ctx?.lease?.id]);

  if (ctxLoading || loading) {
    return (
      <TenantLayout crumbs={["Documents"]}>
        <div className="text-muted-foreground">Loading…</div>
      </TenantLayout>
    );
  }

  if (leases.length === 0) {
    return (
      <TenantLayout crumbs={["Documents"]}>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Documents</h1>
        <div className="rounded-xl border border-border bg-card p-12 mt-6 text-center text-muted-foreground">
          No leases found — documents will appear once your lease is set up.
        </div>
      </TenantLayout>
    );
  }

  const selected = leases.find((l) => l.id === selectedLeaseId) ?? leases[0];

  return (
    <TenantLayout crumbs={["Documents"]}>
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Documents</h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            Securely share files with your landlord. Only you and your landlord can see files on this
            lease.
          </p>
        </div>
        {leases.length > 1 && (
          <Select value={selected.id} onValueChange={setSelectedLeaseId}>
            <SelectTrigger className="w-[260px]">
              <SelectValue placeholder="Select lease" />
            </SelectTrigger>
            <SelectContent>
              {leases.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.unit_label ?? "Unit"} · {new Date(l.start_date).getFullYear()}–
                  {new Date(l.end_date).getFullYear()}
                  {l.status === "active" ? " (Active)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="mt-6">
        <LeaseDocuments
          leaseId={selected.id}
          currentUserId={ctx!.userId}
          uploaderLabels={{
            [selected.landlord_id]: selected.landlord_name ?? "Landlord",
            [ctx!.userId]: "You",
          }}
        />
      </div>
    </TenantLayout>
  );
}
