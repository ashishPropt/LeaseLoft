
-- Allow landlords to view profiles of tenants connected to them
-- (either via a redeemed invite they created, or via any lease they own)
CREATE POLICY "landlords view connected tenant profiles"
  ON public.profiles
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'landlord'::app_role)
    AND (
      EXISTS (
        SELECT 1 FROM public.invite_codes ic
        WHERE ic.created_by = auth.uid()
          AND ic.used_by = profiles.id
      )
      OR EXISTS (
        SELECT 1 FROM public.leases l
        WHERE l.landlord_id = auth.uid()
          AND l.tenant_id = profiles.id
      )
    )
  );
