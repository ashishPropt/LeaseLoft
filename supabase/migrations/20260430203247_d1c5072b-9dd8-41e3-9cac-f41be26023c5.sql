-- Revoke all column-level access to the sensitive provider_access_token
-- from client roles. Edge functions use service_role which bypasses these grants.
REVOKE SELECT (provider_access_token) ON public.payment_methods FROM anon, authenticated;
REVOKE INSERT (provider_access_token) ON public.payment_methods FROM anon, authenticated;
REVOKE UPDATE (provider_access_token) ON public.payment_methods FROM anon, authenticated;