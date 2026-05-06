
-- 1. Private documents bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,
  26214400,
  ARRAY[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Helper: extract lease_id from object path "lease/<uuid>/<file>"
CREATE OR REPLACE FUNCTION public.lease_id_from_object_path(_name text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN split_part(_name, '/', 1) = 'lease'
     AND split_part(_name, '/', 2) <> ''
    THEN NULLIF(split_part(_name, '/', 2), '')::uuid
    ELSE NULL
  END;
$$;

-- 3. Helper: is current user landlord or tenant on the lease at this object path?
CREATE OR REPLACE FUNCTION public.user_can_access_lease_object(_name text, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.leases l
    WHERE l.id = public.lease_id_from_object_path(_name)
      AND (l.landlord_id = _user_id OR l.tenant_id = _user_id)
  );
$$;

-- 4. Storage RLS policies for the documents bucket
DROP POLICY IF EXISTS "documents read lease members" ON storage.objects;
CREATE POLICY "documents read lease members"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'documents'
  AND (
    public.user_can_access_lease_object(name, auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
);

DROP POLICY IF EXISTS "documents insert lease members" ON storage.objects;
CREATE POLICY "documents insert lease members"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'documents'
  AND public.user_can_access_lease_object(name, auth.uid())
);

DROP POLICY IF EXISTS "documents delete lease members" ON storage.objects;
CREATE POLICY "documents delete lease members"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'documents'
  AND (
    public.user_can_access_lease_object(name, auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
);

-- 5. Allow tenants on the lease to insert document rows
DROP POLICY IF EXISTS "tenants insert lease docs" ON public.documents;
CREATE POLICY "tenants insert lease docs"
ON public.documents FOR INSERT
WITH CHECK (
  auth.uid() = owner_id
  AND lease_id IS NOT NULL
  AND public.tenant_has_lease_on_unit(
    (SELECT unit_id FROM public.leases WHERE id = lease_id),
    auth.uid()
  )
);

-- Allow landlords on the lease to delete any docs (in addition to existing owner-delete)
DROP POLICY IF EXISTS "landlords delete lease docs" ON public.documents;
CREATE POLICY "landlords delete lease docs"
ON public.documents FOR DELETE
USING (
  lease_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.leases l
    WHERE l.id = documents.lease_id AND l.landlord_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "admins delete docs" ON public.documents;
CREATE POLICY "admins delete docs"
ON public.documents FOR DELETE
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 6. Server-side validation trigger: enforce size, MIME, and lease membership
CREATE OR REPLACE FUNCTION public.validate_document_upload()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed text[] := ARRAY[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv'
  ];
BEGIN
  IF NEW.size_bytes IS NULL OR NEW.size_bytes <= 0 THEN
    RAISE EXCEPTION 'Document size is required';
  END IF;
  IF NEW.size_bytes > 26214400 THEN
    RAISE EXCEPTION 'File too large (max 25 MB)';
  END IF;
  IF NEW.mime_type IS NULL OR NOT (NEW.mime_type = ANY(v_allowed)) THEN
    RAISE EXCEPTION 'File type not allowed: %', COALESCE(NEW.mime_type, 'unknown');
  END IF;
  IF NEW.lease_id IS NULL THEN
    RAISE EXCEPTION 'lease_id is required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.leases l
    WHERE l.id = NEW.lease_id
      AND (l.landlord_id = auth.uid() OR l.tenant_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'Not authorized to upload to this lease';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_document_upload_trg ON public.documents;
CREATE TRIGGER validate_document_upload_trg
BEFORE INSERT ON public.documents
FOR EACH ROW EXECUTE FUNCTION public.validate_document_upload();
