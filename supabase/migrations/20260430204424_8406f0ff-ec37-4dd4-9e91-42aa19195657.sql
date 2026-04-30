-- Remove the public insert policy; only service role (edge function) can insert now
DROP POLICY IF EXISTS "anyone can submit invite request" ON public.invite_requests;