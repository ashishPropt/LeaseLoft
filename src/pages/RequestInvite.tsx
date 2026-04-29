import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const schema = z.object({
  first_name: z.string().trim().min(1, "First name is required").max(100),
  last_name: z.string().trim().min(1, "Last name is required").max(100),
  email: z.string().trim().email("Enter a valid email").max(255),
  requested_role: z.enum(["landlord", "tenant"]),
  note: z.string().trim().max(1000).optional(),
});

const RequestInvite = () => {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    requested_role: "" as "" | "landlord" | "tenant",
    note: "",
  });

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
      toast.error(first || "Please fill out all required fields");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("invite_requests").insert({
      first_name: parsed.data.first_name,
      last_name: parsed.data.last_name,
      email: parsed.data.email,
      requested_role: parsed.data.requested_role,
      note: parsed.data.note || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error("We couldn't submit your request right now. Please try again.");
      return;
    }
    setSubmitted(true);
    toast.success("Request received");
  }

  if (submitted) {
    return (
      <AuthLayout
        title="Request received"
        subtitle="Thanks! An admin will review your request and email you an invite code if approved."
        footer={
          <Link to="/" className="text-primary font-medium hover:underline">
            Back to home
          </Link>
        }
      >
        <div className="space-y-4">
          <div className="rounded-md border bg-muted/40 p-4 text-sm">
            <div className="font-medium text-foreground">What happens next?</div>
            <ul className="mt-2 list-disc pl-5 text-muted-foreground space-y-1">
              <li>An admin reviews your request, usually within 1–2 business days.</li>
              <li>If approved, we'll send your single-use invite code to <span className="font-medium text-foreground">{form.email}</span>.</li>
              <li>Use that code on the Sign Up page to create your account.</li>
            </ul>
          </div>
          <Button variant="outline" className="w-full" onClick={() => navigate("/signin")}>
            Go to sign in
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Request an invite"
      subtitle="LeaseLoft™ is invite-only. Tell us a bit about you and we'll get a code over to you."
      footer={
        <>
          Already have a code?{" "}
          <Link to="/signup" className="text-primary font-medium hover:underline">Sign up</Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="first">First name</Label>
            <Input id="first" required value={form.first_name} onChange={(e) => set("first_name", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="last">Last name</Label>
            <Input id="last" required value={form.last_name} onChange={(e) => set("last_name", e.target.value)} />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required value={form.email} onChange={(e) => set("email", e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="role">Role</Label>
          <Select value={form.requested_role} onValueChange={(v) => set("requested_role", v)}>
            <SelectTrigger id="role">
              <SelectValue placeholder="Select a role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="landlord">Landlord</SelectItem>
              <SelectItem value="tenant">Tenant</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="note">Anything we should know? (optional)</Label>
          <Textarea
            id="note"
            rows={3}
            maxLength={1000}
            placeholder="e.g. how you heard about us, property details, who referred you…"
            value={form.note}
            onChange={(e) => set("note", e.target.value)}
          />
        </div>

        <Button type="submit" className="w-full" disabled={submitting || !form.requested_role}>
          {submitting ? "Submitting…" : "Request invite code"}
        </Button>
      </form>
    </AuthLayout>
  );
};

export default RequestInvite;
