-- Revoke from PUBLIC and anon on all SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tenant_has_lease_with_landlord(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.landlord_invited_user(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_owns_property(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.landlord_has_lease_with_tenant(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.tenant_has_lease_on_property(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.tenant_has_lease_on_unit(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_lease_property_id() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.redeem_invite_code(text, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.generate_lease_payments(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.landlord_update_payment_status(uuid, public.payment_status, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.leases_sync_payments() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_payment_status_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;