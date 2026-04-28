
-- Tenants can view units for their leases
CREATE POLICY "tenants view lease units"
  ON public.units FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.leases l
    WHERE l.unit_id = units.id AND l.tenant_id = auth.uid()
  ));

-- Tenants can view properties for their leases
CREATE POLICY "tenants view lease properties"
  ON public.properties FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.leases l
    JOIN public.units u ON u.id = l.unit_id
    WHERE u.property_id = properties.id AND l.tenant_id = auth.uid()
  ));

-- Tenants can view their landlord's profile
CREATE POLICY "tenants view landlord profile"
  ON public.profiles FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.leases l
    WHERE l.landlord_id = profiles.id AND l.tenant_id = auth.uid()
  ));
