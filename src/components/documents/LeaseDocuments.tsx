import { useEffect, useRef, useState } from "react";
import { FileText, Download, Trash2, Upload, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { shortDate } from "@/lib/format";
import {
  DOCUMENT_ACCEPT,
  DOCUMENT_LIMITS_HELP,
  sanitizeFileName,
  validateDocumentFile,
} from "@/lib/documentLimits";
import { randomUUID } from "@/lib/device";

interface Doc {
  id: string;
  name: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
  storage_path: string;
  owner_id: string;
}

function fmtSize(n: number | null) {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

interface Props {
  leaseId: string;
  currentUserId: string;
  /** Map of user_id -> display label, e.g. landlord & tenant names */
  uploaderLabels?: Record<string, string>;
  /** Whether current user can delete other people's uploads (landlord on lease) */
  canDeleteOthers?: boolean;
}

export function LeaseDocuments({ leaseId, currentUserId, uploaderLabels = {}, canDeleteOthers = false }: Props) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    const { data } = await supabase
      .from("documents")
      .select("id,name,mime_type,size_bytes,created_at,storage_path,owner_id")
      .eq("lease_id", leaseId)
      .order("created_at", { ascending: false });
    setDocs((data as Doc[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [leaseId]);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    let okCount = 0;
    for (const file of Array.from(files)) {
      const err = validateDocumentFile(file);
      if (err) {
        toast({ title: `Skipped ${file.name}`, description: err, variant: "destructive" });
        continue;
      }
      const path = `lease/${leaseId}/${randomUUID()}-${sanitizeFileName(file.name)}`;
      const { error: upErr } = await supabase.storage
        .from("documents")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) {
        toast({ title: `Upload failed: ${file.name}`, description: upErr.message, variant: "destructive" });
        continue;
      }
      const { error: insErr } = await supabase.from("documents").insert({
        lease_id: leaseId,
        owner_id: currentUserId,
        name: file.name,
        storage_path: path,
        size_bytes: file.size,
        mime_type: file.type,
      });
      if (insErr) {
        await supabase.storage.from("documents").remove([path]);
        toast({ title: `Upload failed: ${file.name}`, description: insErr.message, variant: "destructive" });
        continue;
      }
      okCount++;
    }
    if (okCount > 0) toast({ title: `${okCount} file${okCount === 1 ? "" : "s"} uploaded` });
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
    refresh();
  }

  async function download(d: Doc) {
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(d.storage_path, 60);
    if (error || !data?.signedUrl) {
      return toast({ title: "Download failed", description: error?.message ?? "File not available.", variant: "destructive" });
    }
    window.open(data.signedUrl, "_blank");
  }

  async function remove(d: Doc) {
    if (!confirm(`Delete "${d.name}"? This cannot be undone.`)) return;
    const { error: dbErr } = await supabase.from("documents").delete().eq("id", d.id);
    if (dbErr) return toast({ title: "Delete failed", description: dbErr.message, variant: "destructive" });
    await supabase.storage.from("documents").remove([d.storage_path]);
    toast({ title: "File deleted" });
    refresh();
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-foreground">
          <FileText className="w-4 h-4" />
          <h2 className="font-semibold">Documents</h2>
        </div>
        <div>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={DOCUMENT_ACCEPT}
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <Button size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Upload className="w-3.5 h-3.5 mr-1.5" />}
            Upload
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-2">{DOCUMENT_LIMITS_HELP} Files are private to the landlord and tenant on this lease.</p>

      <div className="mt-4">
        {loading ? (
          <div className="py-8 text-center text-muted-foreground text-sm">Loading…</div>
        ) : docs.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground text-sm">
            No documents shared yet.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {docs.map((d) => {
              const isMine = d.owner_id === currentUserId;
              const canDelete = isMine || canDeleteOthers;
              const uploader = isMine ? "You" : uploaderLabels[d.owner_id] ?? "Other party";
              return (
                <li key={d.id} className="flex items-center gap-4 py-3">
                  <div className="w-10 h-10 rounded-lg border border-border grid place-items-center text-muted-foreground shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-foreground truncate">{d.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {fmtSize(d.size_bytes)} · {shortDate(d.created_at)} · Uploaded by {uploader}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => download(d)}>
                    <Download className="w-4 h-4 mr-2" />Download
                  </Button>
                  {canDelete && (
                    <Button variant="ghost" size="sm" onClick={() => remove(d)} aria-label="Delete">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
