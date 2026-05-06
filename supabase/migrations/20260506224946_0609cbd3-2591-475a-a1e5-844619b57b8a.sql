
DROP POLICY IF EXISTS "landlords view lease docs" ON public.documents;
CREATE POLICY "landlords view lease docs"
ON public.documents FOR SELECT
USING (
  lease_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.leases l
    WHERE l.id = documents.lease_id AND l.landlord_id = auth.uid()
  )
);
