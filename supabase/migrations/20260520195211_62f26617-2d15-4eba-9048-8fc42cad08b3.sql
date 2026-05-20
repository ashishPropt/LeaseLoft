
CREATE TABLE public.plan_unit_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_price_id text NOT NULL UNIQUE,
  max_units integer NOT NULL CHECK (max_units >= 0),
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.plan_unit_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage plan limits"
  ON public.plan_unit_limits FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "authenticated read plan limits"
  ON public.plan_unit_limits FOR SELECT
  TO authenticated
  USING (true);

CREATE TRIGGER plan_unit_limits_updated_at
  BEFORE UPDATE ON public.plan_unit_limits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.enforce_unit_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_status text;
  v_price text;
  v_max integer;
  v_count integer;
BEGIN
  -- Admins bypass
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  SELECT owner_id INTO v_owner FROM public.properties WHERE id = NEW.property_id;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Property not found';
  END IF;

  SELECT stripe_subscription_status, subscription_price_id
    INTO v_status, v_price
  FROM public.profiles WHERE id = v_owner;

  IF v_status IS NULL OR v_status NOT IN ('active','trialing') THEN
    RAISE EXCEPTION 'Active subscription required to add units.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_price IS NULL THEN
    RAISE EXCEPTION 'Your plan does not allow adding units. Contact support.'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT max_units INTO v_max FROM public.plan_unit_limits WHERE stripe_price_id = v_price;
  IF v_max IS NULL THEN
    RAISE EXCEPTION 'Your plan has no unit allowance configured. Contact support.'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.units u
  JOIN public.properties p ON p.id = u.property_id
  WHERE p.owner_id = v_owner;

  IF v_count >= v_max THEN
    RAISE EXCEPTION 'Plan limit reached (% of % units used). Upgrade your plan to add more.', v_count, v_max
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_unit_limit_trg
  BEFORE INSERT ON public.units
  FOR EACH ROW EXECUTE FUNCTION public.enforce_unit_limit();
