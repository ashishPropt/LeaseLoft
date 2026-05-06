import { TenantLayout } from "@/components/layout/TenantLayout";
import { useTenantContext } from "@/lib/useTenantContext";
import { LeaseDocuments } from "@/components/documents/LeaseDocuments";

export default function TenantDocuments() {
  const { ctx, loading } = useTenantContext();

  return (
    <TenantLayout crumbs={["Documents"]}>
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">Documents</h1>
      <p className="text-muted-foreground mt-1.5 text-sm">
        Securely share files with your landlord. Only you and your landlord can see files on this lease.
      </p>

      <div className="mt-6">
        {loading ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
            Loading…
          </div>
        ) : !ctx?.lease ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
            No active lease — documents will appear once your lease is set up.
          </div>
        ) : (
          <LeaseDocuments
            leaseId={ctx.lease.id}
            currentUserId={ctx.userId}
            uploaderLabels={{
              [ctx.lease.landlord_id]: ctx.landlordName ?? "Landlord",
              [ctx.userId]: "You",
            }}
          />
        )}
      </div>
    </TenantLayout>
  );
}
