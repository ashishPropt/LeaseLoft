import { useEffect, useState } from "react";
import { FileText, Download } from "lucide-react";
import { TenantLayout } from "@/components/layout/TenantLayout";
import { Button } from "@/components/ui/button";
import { useTenantContext } from "@/lib/useTenantContext";
import { supabase } from "@/integrations/supabase/client";
import { shortDate } from "@/lib/format";
import { toast } from "@/hooks/use-toast";

interface Doc { id: string; name: string; mime_type: string | null; size_bytes: number | null; created_at: string; storage_path: string; }

function fmtSize(n: number | null) {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export default function TenantDocuments() {
  const { ctx } = useTenantContext();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ctx?.lease) { setLoading(false); return; }
    (async () => {
      const { data } = await supabase
        .from("documents")
        .select("id,name,mime_type,size_bytes,created_at,storage_path")
        .eq("lease_id", ctx.lease!.id)
        .order("created_at", { ascending: false });
      setDocs((data as Doc[]) ?? []);
      setLoading(false);
    })();
  }, [ctx?.lease?.id]);

  async function download(d: Doc) {
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(d.storage_path, 60);
    if (error || !data?.signedUrl) {
      return toast({ title: "Download failed", description: error?.message ?? "File not available.", variant: "destructive" });
    }
    window.open(data.signedUrl, "_blank");
  }

  return (
    <TenantLayout crumbs={["Documents"]}>
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">Documents</h1>
      <p className="text-muted-foreground mt-1.5 text-sm">Lease, receipts and other files shared by your landlord.</p>

      <div className="rounded-xl border border-border bg-card mt-6">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground">Loading…</div>
        ) : docs.length === 0 ? (
          <div className="p-16 text-center text-muted-foreground">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
            No documents yet.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {docs.map(d => (
              <li key={d.id} className="flex items-center gap-4 px-6 py-4">
                <div className="w-10 h-10 rounded-lg border border-border grid place-items-center text-muted-foreground shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-foreground truncate">{d.name}</div>
                  <div className="text-xs text-muted-foreground">{fmtSize(d.size_bytes)} · {shortDate(d.created_at)}</div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => download(d)}>
                  <Download className="w-4 h-4 mr-2" />Download
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </TenantLayout>
  );
}
