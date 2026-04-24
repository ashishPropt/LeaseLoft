-- 1. Add property_id to leases for direct joins
ALTER TABLE public.leases ADD COLUMN IF NOT EXISTS property_id uuid;

-- Backfill from existing units
UPDATE public.leases l
SET property_id = u.property_id
FROM public.units u
WHERE l.unit_id = u.id AND l.property_id IS NULL;

-- Trigger to auto-fill property_id from unit on insert/update
CREATE OR REPLACE FUNCTION public.set_lease_property_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.property_id IS NULL OR (TG_OP = 'UPDATE' AND NEW.unit_id IS DISTINCT FROM OLD.unit_id) THEN
    SELECT property_id INTO NEW.property_id FROM public.units WHERE id = NEW.unit_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lease_property_id ON public.leases;
CREATE TRIGGER trg_lease_property_id
BEFORE INSERT OR UPDATE ON public.leases
FOR EACH ROW EXECUTE FUNCTION public.set_lease_property_id();

-- updated_at triggers for relevant tables
DROP TRIGGER IF EXISTS trg_properties_updated ON public.properties;
CREATE TRIGGER trg_properties_updated BEFORE UPDATE ON public.properties
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_units_updated ON public.units;
CREATE TRIGGER trg_units_updated BEFORE UPDATE ON public.units
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_leases_updated ON public.leases;
CREATE TRIGGER trg_leases_updated BEFORE UPDATE ON public.leases
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_payments_updated ON public.payments;
CREATE TRIGGER trg_payments_updated BEFORE UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_maintenance_updated ON public.maintenance_requests;
CREATE TRIGGER trg_maintenance_updated BEFORE UPDATE ON public.maintenance_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert demo invite codes (idempotent)
INSERT INTO public.invite_codes (code, role, max_uses, used_count, created_by_name, expires_at)
VALUES
  ('LL-2026-XJ4K', 'landlord', 1, 0, 'System Administrator', now() + interval '30 days'),
  ('TN-2026-A7B3', 'tenant',   1, 0, 'Jordan Chen',          now() + interval '30 days'),
  ('TN-2026-USED','tenant',    1, 1, 'System Administrator', now() - interval '5 days')
ON CONFLICT (code) DO NOTHING;