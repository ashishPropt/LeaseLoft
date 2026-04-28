import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, Plus, Pencil, Trash2 } from "lucide-react";
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
import { toast } from "sonner";

interface Row {
  id: string;
  name: string;
  address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  unitCount: number;
}

interface FormState {
  id?: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
}

const empty: FormState = { name: "", address: "", city: "", state: "", zip: "" };

export default function LandlordProperties() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [uid, setUid] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(empty);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function load(userId: string) {
    setLoading(true);
    const { data: props } = await supabase
      .from("properties")
      .select("id,name,address,city,state,zip")
      .eq("owner_id", userId)
      .order("name", { ascending: true });
    const ids = (props ?? []).map(p => p.id);
    let counts = new Map<string, number>();
    if (ids.length) {
      const { data: units } = await supabase.from("units").select("id,property_id").in("property_id", ids);
      (units ?? []).forEach(u => counts.set(u.property_id, (counts.get(u.property_id) ?? 0) + 1));
    }
    setRows((props ?? []).map(p => ({ ...p, unitCount: counts.get(p.id) ?? 0 })));
    setLoading(false);
  }

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) return;
      setUid(s.session.user.id);
      await load(s.session.user.id);
    })();
  }, []);

  function openNew() {
    setForm(empty);
    setOpen(true);
  }
  function openEdit(r: Row) {
    setForm({
      id: r.id,
      name: r.name,
      address: r.address,
      city: r.city ?? "",
      state: r.state ?? "",
      zip: r.zip ?? "",
    });
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.address.trim()) {
      toast.error("Name and address are required.");
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      address: form.address.trim(),
      city: form.city.trim() || null,
      state: form.state.trim() || null,
      zip: form.zip.trim() || null,
      owner_id: uid,
    };
    const res = form.id
      ? await supabase.from("properties").update(payload).eq("id", form.id)
      : await supabase.from("properties").insert(payload);
    setSaving(false);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    toast.success(form.id ? "Property updated" : "Property added");
    setOpen(false);
    await load(uid);
  }

  async function confirmDelete() {
    if (!deleteId) return;
    const res = await supabase.from("properties").delete().eq("id", deleteId);
    if (res.error) {
      toast.error(res.error.message.includes("foreign key")
        ? "Remove its units and leases first."
        : res.error.message);
    } else {
      toast.success("Property deleted");
      await load(uid);
    }
    setDeleteId(null);
  }

  return (
    <LandlordLayout crumbs={["Properties"]}>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Properties</h1>
          <p className="text-muted-foreground mt-1.5 text-sm">Add, edit and manage your properties and their units.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" />Add property</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{form.id ? "Edit property" : "New property"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={save} className="space-y-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input id="name" className="mt-1.5" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} maxLength={120} />
              </div>
              <div>
                <Label htmlFor="address">Address</Label>
                <Input id="address" className="mt-1.5" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} maxLength={200} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Label htmlFor="city">City</Label>
                  <Input id="city" className="mt-1.5" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} maxLength={80} />
                </div>
                <div>
                  <Label htmlFor="state">State</Label>
                  <Input id="state" className="mt-1.5" value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} maxLength={20} />
                </div>
              </div>
              <div>
                <Label htmlFor="zip">ZIP</Label>
                <Input id="zip" className="mt-1.5" value={form.zip} onChange={e => setForm({ ...form, zip: e.target.value })} maxLength={20} />
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
              <th className="text-left font-medium px-6 py-4">Property</th>
              <th className="text-left font-medium px-6 py-4">Address</th>
              <th className="text-left font-medium px-6 py-4">Units</th>
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={4} className="px-6 py-16 text-center text-muted-foreground">
                <Building2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
                No properties yet. Click "Add property" to get started.
              </td></tr>
            ) : rows.map(r => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-6 py-4 font-medium text-foreground">
                  <Link to={`/landlord/properties/${r.id}`} className="hover:underline">{r.name}</Link>
                </td>
                <td className="px-6 py-4 text-muted-foreground">
                  {[r.address, r.city, r.state, r.zip].filter(Boolean).join(", ") || "—"}
                </td>
                <td className="px-6 py-4 text-muted-foreground">{r.unitCount}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-end gap-2">
                    <Link to={`/landlord/properties/${r.id}`}>
                      <Button size="sm" variant="ghost">Manage units</Button>
                    </Link>
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
            <AlertDialogTitle>Delete this property?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the property. Units or leases attached to it must be removed first.
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
