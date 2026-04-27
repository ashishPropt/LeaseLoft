-- Track invite creator so landlords can manage their own invites
ALTER TABLE public.invite_codes
  ADD COLUMN IF NOT EXISTS created_by uuid;

-- Allow landlords to create tenant invites (must set created_by = themselves, role must be 'tenant')
CREATE POLICY "landlords create tenant invites"
  ON public.invite_codes
  FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'landlord'::app_role)
    AND role = 'tenant'::app_role
    AND created_by = auth.uid()
  );

-- Allow landlords to view invites they created
CREATE POLICY "landlords view own invites"
  ON public.invite_codes
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'landlord'::app_role)
    AND created_by = auth.uid()
  );

-- Allow landlords to update/delete invites they created (e.g. revoke)
CREATE POLICY "landlords update own invites"
  ON public.invite_codes
  FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'landlord'::app_role)
    AND created_by = auth.uid()
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'landlord'::app_role)
    AND created_by = auth.uid()
  );

CREATE POLICY "landlords delete own invites"
  ON public.invite_codes
  FOR DELETE
  USING (
    public.has_role(auth.uid(), 'landlord'::app_role)
    AND created_by = auth.uid()
  );