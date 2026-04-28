
CREATE OR REPLACE FUNCTION public.user_owns_property(_property_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.properties p WHERE p.id = _property_id AND p.owner_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.tenant_has_lease_on_unit(_unit_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.leases l WHERE l.unit_id = _unit_id AND l.tenant_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.tenant_has_lease_on_property(_property_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.leases l
    JOIN public.units u ON u.id = l.unit_id
    WHERE u.property_id = _property_id AND l.tenant_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.tenant_has_lease_with_landlord(_landlord_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.leases l WHERE l.landlord_id = _landlord_id AND l.tenant_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.landlord_invited_user(_invited_user_id uuid, _landlord_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.invite_codes ic WHERE ic.created_by = _landlord_id AND ic.used_by = _invited_user_id);
$$;

CREATE OR REPLACE FUNCTION public.landlord_has_lease_with_tenant(_landlord_id uuid, _tenant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.leases l WHERE l.landlord_id = _landlord_id AND l.tenant_id = _tenant_id);
$$;

DROP POLICY IF EXISTS "owners manage units" ON public.units;
DROP POLICY IF EXISTS "tenants view lease units" ON public.units;

CREATE POLICY "owners manage units" ON public.units
  FOR ALL USING (public.user_owns_property(property_id, auth.uid()))
  WITH CHECK (public.user_owns_property(property_id, auth.uid()));

CREATE POLICY "tenants view lease units" ON public.units
  FOR SELECT USING (public.tenant_has_lease_on_unit(id, auth.uid()));

DROP POLICY IF EXISTS "tenants view lease properties" ON public.properties;

CREATE POLICY "tenants view lease properties" ON public.properties
  FOR SELECT USING (public.tenant_has_lease_on_property(id, auth.uid()));

DROP POLICY IF EXISTS "tenants view landlord profile" ON public.profiles;
DROP POLICY IF EXISTS "landlords view connected tenant profiles" ON public.profiles;

CREATE POLICY "tenants view landlord profile" ON public.profiles
  FOR SELECT USING (public.tenant_has_lease_with_landlord(id, auth.uid()));

CREATE POLICY "landlords view connected tenant profiles" ON public.profiles
  FOR SELECT USING (
    public.has_role(auth.uid(), 'landlord'::app_role) AND (
      public.landlord_invited_user(id, auth.uid())
      OR public.landlord_has_lease_with_tenant(auth.uid(), id)
    )
  );
