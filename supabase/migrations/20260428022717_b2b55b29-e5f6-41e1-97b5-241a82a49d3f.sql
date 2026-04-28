
REVOKE EXECUTE ON FUNCTION public.user_owns_property(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.tenant_has_lease_on_unit(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.tenant_has_lease_on_property(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.tenant_has_lease_with_landlord(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.landlord_invited_user(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.landlord_has_lease_with_tenant(uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.user_owns_property(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tenant_has_lease_on_unit(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tenant_has_lease_on_property(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tenant_has_lease_with_landlord(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.landlord_invited_user(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.landlord_has_lease_with_tenant(uuid, uuid) TO authenticated;
