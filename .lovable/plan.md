## Problem

Tenants get `new row violates row-level security policy for table payments` when clicking **Pay rent** or **Pay by card**. Both flows in `src/pages/tenant/PayRent.tsx` do a client-side `supabase.from("payments").insert(...)` to create a pending row before invoking the edge function.

The `payments` table only has these policies:
- `landlords manage payments` (ALL)
- `landlords / tenants / admins` SELECT policies

There is **no INSERT policy for tenants**, so the client insert is rejected.

## Fix

Add an RLS INSERT policy that lets a tenant create a pending payment row only for a lease they're on, and only with safe initial values.

```sql
CREATE POLICY "tenants insert own pending payments"
ON public.payments
FOR INSERT
TO authenticated
WITH CHECK (
  status = 'pending'
  AND paid_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.leases l
    WHERE l.id = payments.lease_id
      AND l.tenant_id = auth.uid()
  )
);
```

Constraints in the `WITH CHECK`:
- Tenant must be the `tenant_id` on the referenced lease.
- Row must start as `pending` with no `paid_at` (status is later moved to `processing` / `paid` by the service-role edge functions, which bypass RLS).

No frontend changes needed — `PayRent.tsx` already inserts with `status: "pending"` and no `paid_at`.

## Scope

- One migration adding the policy above.
- No code changes, no schema changes.