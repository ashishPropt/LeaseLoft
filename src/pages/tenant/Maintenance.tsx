import { useEffect, useState } from "react";
import { Plus, Wrench } from "lucide-react";
import { TenantLayout } from "@/components/layout/TenantLayout";
import { StatusPill } from "@/components/layout/StatusPill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useTenantContext } from "@/lib/useTenantContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { monthDay } from "@/lib/format";

interface Item {
  id: string; title: string; description: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  status: "open" | "in_progress" | "resolved" | "closed";
  created_at: string;
}

const tone = { open: "warning", in_progress: "info", resolved: "success", closed: "muted" } as const;
const label = { open: "Open", in_progress: "In progress", resolved: "Resolved", closed: "Closed" } as const;

export default function TenantMaintenance() {
  const { ctx } = useTenantContext();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<{ title: string; description: string; priority: Item["priority"] }>({ title: "", description: "", priority: "medium" });

  async function load() {
    if (!ctx?.lease) { setLoading(false); return; }
    const { data } = await supabase
      .from("maintenance_requests")
      .select("id,title,description,priority,status,created_at")
      .eq("lease_id", ctx.lease.id)
      .order("created_at", { ascending: false });
    setItems((data as Item[]) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [ctx?.lease?.id]);

  async function submit() {
    if (!ctx?.lease || !ctx.userId) return;
    if (!form.title.trim()) return toast({ title: "Title is required", variant: "destructive" });
    setSubmitting(true);
    const { error } = await supabase.from("maintenance_requests").insert({
      lease_id: ctx.lease.id,
      created_by: ctx.userId,
      title: form.title,
      description: form.description || null,
      priority: form.priority,
    });
    setSubmitting(false);
    if (error) return toast({ title: "Could not submit", description: error.message, variant: "destructive" });
    toast({ title: "Request submitted" });
    setForm({ title: "", description: "", priority: "medium" });
    setOpen(false);
    load();
  }

  return (
    <TenantLayout crumbs={["Maintenance"]}>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Maintenance</h1>
          <p className="text-muted-foreground mt-1.5 text-sm">{items.filter(i => i.status === "open" || i.status === "in_progress").length} open requests</p>
        </div>
        {ctx?.lease && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" />New request</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Report an issue</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Title</Label>
                  <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Leaking kitchen faucet" />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea rows={4} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Add details that will help your landlord." />
                </div>
                <div>
                  <Label>Priority</Label>
                  <Select value={form.priority} onValueChange={v => setForm({ ...form, priority: v as Item["priority"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={submit} disabled={submitting}>{submitting ? "Submitting…" : "Submit request"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              <th className="text-left font-medium px-6 py-4">Issue</th>
              <th className="text-left font-medium px-6 py-4">Priority</th>
              <th className="text-left font-medium px-6 py-4">Submitted</th>
              <th className="text-left font-medium px-6 py-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">Loading…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={4} className="px-6 py-16 text-center text-muted-foreground"><Wrench className="w-8 h-8 mx-auto mb-2 opacity-40" />No requests yet.</td></tr>
            ) : items.map(it => (
              <tr key={it.id} className="border-t border-border">
                <td className="px-6 py-4">
                  <div className="font-medium text-foreground">{it.title}</div>
                  {it.description && <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{it.description}</div>}
                </td>
                <td className="px-6 py-4">
                  <StatusPill tone={it.priority === "urgent" || it.priority === "high" ? "danger" : it.priority === "medium" ? "warning" : "muted"} dot={false}>
                    {it.priority[0].toUpperCase() + it.priority.slice(1)}
                  </StatusPill>
                </td>
                <td className="px-6 py-4 text-muted-foreground">{monthDay(it.created_at)}</td>
                <td className="px-6 py-4"><StatusPill tone={tone[it.status]}>{label[it.status]}</StatusPill></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </TenantLayout>
  );
}
