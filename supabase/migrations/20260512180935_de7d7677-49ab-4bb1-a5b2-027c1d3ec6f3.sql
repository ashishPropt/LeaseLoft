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