import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Gauge } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

interface Row {
  id: string;
  stripe_price_id: string;
  max_units: number;
  label: string | null;
}

interface FormState {
  id?: string;
  stripe_price_id: string;
  max_units: string;
  label: string;
}

const empty: FormState = { stripe_price_id: "", max_units: "", label: "" };

export default function AdminPlanLimits() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(empty);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("plan_unit_limits")
      .select("id,stripe_price_id,max_units,label")
      .order("stripe_price_id", { ascending: true });
    if (error) toast.error(error.message);
    setRows((data ?? []) as Row[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openNew() { setForm(empty); setOpen(true); }
  function openEdit(r: Row) {
    setForm({ id: r.id, stripe_price_id: r.stripe_price_id, max_units: String(r.max_units), label: r.label ?? "" });
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const price = form.stripe_price_id.trim();
    const max = parseInt(form.max_units, 10);
    if (!price.startsWith("price_")) {
      toast.error("Price ID must start with \"price_\".");
      return;
    }
    if (!Number.isFinite(max) || max < 0) {
      toast.error("Max units must be a number greater than or equal to 0.");
      return;
    }
    setSaving(true);
    const payload = {
      stripe_price_id: price,
      max_units: max,
      label: form.label.trim() || null,
    };
    const res = form.id
      ? await supabase.from("plan_unit_limits").update(payload).eq("id", form.id)
      : await supabase.from("plan_unit_limits").insert(payload);
    setSaving(false);
    if (res.error) {
      toast.error(res.error.message.includes("duplicate")
        ? "A limit for this price ID already exists."
        : res.error.message);
      return;
    }
    toast.success(form.id ? "Plan limit updated" : "Plan limit added");
    setOpen(false);
    await load();
  }

  async function confirmDelete() {
    if (!deleteId) return;
    const res = await supabase.from("plan_unit_limits").delete().eq("id", deleteId);
    if (res.error) toast.error(res.error.message);
    else { toast.success("Plan limit deleted"); await load(); }
    setDeleteId(null);
  }

  return (
    <AdminLayout crumbs={["Plan Limits"]}>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Plan Limits</h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            Configure how many units each subscription plan allows. Landlords without a configured plan cannot create units.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" />Add limit</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{form.id ? "Edit plan limit" : "New plan limit"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={save} className="space-y-4">
              <div>
                <Label htmlFor="price">Stripe price ID</Label>
                <Input
                  id="price"
                  className="mt-1.5"
                  placeholder="price_1ABCxyz..."
                  value={form.stripe_price_id}
                  onChange={e => setForm({ ...form, stripe_price_id: e.target.value })}
                  maxLength={200}
                />
              </div>
              <div>
                <Label htmlFor="max">Max units</Label>
                <Input
                  id="max"
                  type="number"
                  min={0}
                  className="mt-1.5"
                  value={form.max_units}
                  onChange={e => setForm({ ...form, max_units: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="label">Label (optional)</Label>
                <Input
                  id="label"
                  className="mt-1.5"
                  placeholder="Starter / 5 units"
                  value={form.label}
                  onChange={e => setForm({ ...form, label: e.target.value })}
                  maxLength={120}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={saving}>{saving ? "Saving…" : form.id ? "Save changes" : "Create"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-xl border border-border bg-card mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              <th className="text-left font-medium px-6 py-4">Price ID</th>
              <th className="text-left font-medium px-6 py-4">Label</th>
              <th className="text-left font-medium px-6 py-4">Max units</th>
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={4} className="px-6 py-16 text-center text-muted-foreground">
                <Gauge className="w-8 h-8 mx-auto mb-2 opacity-40" />
                No plan limits configured yet.
              </td></tr>
            ) : rows.map(r => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-6 py-4 font-mono text-xs text-foreground">{r.stripe_price_id}</td>
                <td className="px-6 py-4 text-muted-foreground">{r.label ?? "—"}</td>
                <td className="px-6 py-4 text-foreground">{r.max_units}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeleteId(r.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this plan limit?</AlertDialogTitle>
            <AlertDialogDescription>
              Landlords on this price will no longer be able to add new units until a limit is reconfigured.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
