-- These functions are only ever invoked via service_role (edge functions) or
-- internal triggers — never by an authenticated client directly.
REVOKE EXECUTE ON FUNCTION public.redeem_invite_code(text, uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_lease_payments(uuid) FROM authenticated;