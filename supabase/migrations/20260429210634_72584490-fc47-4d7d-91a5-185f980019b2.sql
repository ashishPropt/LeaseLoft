-- Status enum
CREATE TYPE public.invite_request_status AS ENUM ('pending', 'approved', 'rejected');

-- Table
CREATE TABLE public.invite_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  requested_role public.app_role NOT NULL,
  note text,
  status public.invite_request_status NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_notes text,
  generated_invite_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Restrict requested_role to landlord/tenant only
ALTER TABLE public.invite_requests
  ADD CONSTRAINT invite_requests_role_check
  CHECK (requested_role IN ('landlord', 'tenant'));

CREATE INDEX idx_invite_requests_status ON public.invite_requests(status, created_at DESC);

-- Updated-at trigger
CREATE TRIGGER update_invite_requests_updated_at
BEFORE UPDATE ON public.invite_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.invite_requests ENABLE ROW LEVEL SECURITY;

-- Anyone (including anonymous) may submit a request
CREATE POLICY "anyone can submit invite request"
ON public.invite_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (
  status = 'pending'
  AND reviewed_by IS NULL
  AND reviewed_at IS NULL
  AND generated_invite_code IS NULL
  AND char_length(first_name) BETWEEN 1 AND 100
  AND char_length(last_name) BETWEEN 1 AND 100
  AND char_length(email) BETWEEN 3 AND 255
  AND email ~* '^[^\s@]+@[^\s@]+\.[^\s@]+$'
  AND (note IS NULL OR char_length(note) <= 1000)
);

-- Admins manage
CREATE POLICY "admins view invite requests"
ON public.invite_requests
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins update invite requests"
ON public.invite_requests
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins delete invite requests"
ON public.invite_requests
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));