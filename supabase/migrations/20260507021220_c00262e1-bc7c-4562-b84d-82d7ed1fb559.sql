
-- Block landlords from deleting properties/units that have dependent records.
-- Admins can still delete (cleanup).

CREATE OR REPLACE FUNCTION public.guard_property_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_units int;
  v_leases int;
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN OLD;
  END IF;

  SELECT count(*) INTO v_units FROM public.units WHERE property_id = OLD.id;
  SELECT count(*) INTO v_leases FROM public.leases WHERE property_id = OLD.id;

  IF v_units > 0 OR v_leases > 0 THEN
    RAISE EXCEPTION 'Cannot delete property with existing units or leases. Contact an admin to remove records with transaction history.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS guard_property_delete ON public.properties;
CREATE TRIGGER guard_property_delete
BEFORE DELETE ON public.properties
FOR EACH ROW EXECUTE FUNCTION public.guard_property_delete();


CREATE OR REPLACE FUNCTION public.guard_unit_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_leases int;
  v_payments int;
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN OLD;
  END IF;

  SELECT count(*) INTO v_leases FROM public.leases WHERE unit_id = OLD.id;
  SELECT count(*) INTO v_payments
    FROM public.payments p
    JOIN public.leases l ON l.id = p.lease_id
    WHERE l.unit_id = OLD.id;

  IF v_leases > 0 OR v_payments > 0 THEN
    RAISE EXCEPTION 'Cannot delete unit with existing leases or payments. Contact an admin to remove records with transaction history.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS guard_unit_delete ON public.units;
CREATE TRIGGER guard_unit_delete
BEFORE DELETE ON public.units
FOR EACH ROW EXECUTE FUNCTION public.guard_unit_delete();
