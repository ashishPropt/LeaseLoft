import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Plus, Pencil, Trash2, Home } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LandlordLayout } from "@/components/layout/LandlordLayout";
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
import { money } from "@/lib/format";
import { toast } from "sonner";

interface Property {
  id: string; name: string; address: string;
  city: string | null; state: string | null; zip: string | null;
}
interface Unit {
  id: string; label: string; bedrooms: number | null;
  bathrooms: number | null; rent_amount: number | null;
}
interface UnitForm {
  id?: string;
  label: string;
  bedrooms: string;
  bathrooms: string;
  rent_amount: string;
}

const emptyUnit: UnitForm = { label: "", bedrooms: "", bathrooms: "", rent_amount: "" };

export default function LandlordPropertyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [property, setProperty] = useState<Property | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<UnitForm>(emptyUnit);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function load() {
    if (!id) return;
    setLoading(true);
    const [{ data: prop }, { data: u }] = await Promise.all([
      supabase.from("properties").select("id,name,address,city,state,zip").eq("id", id).maybeSingle(),
      supabase.from("units").select("id,label,bedrooms,bathrooms,rent_amount").eq("property_id", id).order("label", { ascending: true }),
    ]);
    setProperty(prop as Property | null);
    setUnits((u ?? []) as Unit[]);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  function openNew() { setForm(emptyUnit); setOpen(true); }
  function openEdit(u: Unit) {
    setForm({
      id: u.id,
      label: u.label,
      bedrooms: u.bedrooms?.toString() ?? "",
      bathrooms: u.bathrooms?.toString() ?? "",
      rent_amount: u.rent_amount?.toString() ?? "",
    });
    setOpen(true);
  }

  async function saveUnit(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    if (!form.label.trim()) { toast.error("Unit label is required."); return; }
    setSaving(true);
    const payload = {
      property_id: id,
      label: form.label.trim(),
      bedrooms: form.bedrooms ? Number(form.bedrooms) : null,
      bathrooms: form.bathrooms ? Number(form.bathrooms) : null,
      rent_amount: form.rent_amount ? Number(form.rent_amount) : null,
    };
    const res = form.id
      ? await supabase.from("units").update(payload).eq("id", form.id)
      : await supabase.from("units").insert(payload);
    setSaving(false);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success(form.id ? "Unit updated" : "Unit added");
    setOpen(false);
    await load();
  }

  async function confirmDelete() {
    if (!deleteId) return;
    const res = await supabase.from("units").delete().eq("id", deleteId);
    if (res.error) {
      toast.error(res.error.message.includes("foreign key")
        ? "Remove leases on this unit first."
        : res.error.message);
    } else {
      toast.success("Unit deleted");
      await load();
    }
    setDeleteId(null);
  }

  if (loading) {
    return <LandlordLayout crumbs={["Properties", "…"]}><div className="text-muted-foreground">Loading…</div></LandlordLayout>;
  }
  if (!property) {
    return (
      <LandlordLayout crumbs={["Properties", "Not found"]}>
        <p className="text-muted-foreground">Property not found.</p>
        <Link to="/landlord/properties" className="text-primary text-sm hover:underline">← Back to properties</Link>
      </LandlordLayout>
    );
  }

  return (
    <LandlordLayout crumbs={["Properties", property.name]}>
      <Button variant="ghost" size="sm" className="-ml-3 mb-3" onClick={() => navigate("/landlord/properties")}>
        <ArrowLeft className="w-4 h-4 mr-1" /> Back
      </Button>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">{property.name}</h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            {[property.address, property.city, property.state, property.zip].filter(Boolean).join(", ") || "—"}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" />Add unit</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{form.id ? "Edit unit" : "New unit"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={saveUnit} className="space-y-4">
              <div>
                <Label htmlFor="label">Label</Label>
                <Input id="label" className="mt-1.5" placeholder="e.g. Apt 2B" value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} maxLength={60} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="beds">Bedrooms</Label>
                  <Input id="beds" type="number" min="0" step="1" className="mt-1.5" value={form.bedrooms} onChange={e => setForm({ ...form, bedrooms: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="baths">Bathrooms</Label>
                  <Input id="baths" type="number" min="0" step="0.5" className="mt-1.5" value={form.bathrooms} onChange={e => setForm({ ...form, bathrooms: e.target.value })} />
                </div>
              </div>
              <div>
                <Label htmlFor="rent">Market rent</Label>
                <Input id="rent" type="number" min="0" step="0.01" className="mt-1.5" value={form.rent_amount} onChange={e => setForm({ ...form, rent_amount: e.target.value })} />
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
              <th className="text-left font-medium px-6 py-4">Unit</th>
              <th className="text-left font-medium px-6 py-4">Beds / Baths</th>
              <th className="text-right font-medium px-6 py-4">Market rent</th>
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody>
            {units.length === 0 ? (
              <tr><td colSpan={4} className="px-6 py-16 text-center text-muted-foreground">
                <Home className="w-8 h-8 mx-auto mb-2 opacity-40" />
                No units yet. Add one to get started.
              </td></tr>
            ) : units.map(u => (
              <tr key={u.id} className="border-t border-border">
                <td className="px-6 py-4 font-medium text-foreground">{u.label}</td>
                <td className="px-6 py-4 text-muted-foreground">{u.bedrooms ?? "—"} / {u.bathrooms ?? "—"}</td>
                <td className="px-6 py-4 text-right font-mono text-foreground">{u.rent_amount != null ? money(Number(u.rent_amount)) : "—"}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(u)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeleteId(u.id)}>
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
            <AlertDialogTitle>Delete this unit?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the unit. Any leases tied to it must be removed first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </LandlordLayout>
  );
}
