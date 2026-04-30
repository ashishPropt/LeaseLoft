-- Audit log for payment status changes
CREATE TABLE public.payment_status_audit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_id UUID NOT NULL,
  changed_by UUID NOT NULL,
  old_status public.payment_status,
  new_status public.payment_status NOT NULL,
  old_paid_at TIMESTAMP WITH TIME ZONE,
  new_paid_at TIMESTAMP WITH TIME ZONE,
  old_method TEXT,
  new_method TEXT,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_payment_status_audit_payment_id ON public.payment_status_audit(payment_id);
CREATE INDEX idx_payment_status_audit_created_at ON public.payment_status_audit(created_at DESC);

ALTER TABLE public.payment_status_audit ENABLE ROW LEVEL SECURITY;

-- Landlords can view audit entries for payments on their leases
CREATE POLICY "landlords view payment audit"
ON public.payment_status_audit
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.payments p
  JOIN public.leases l ON l.id = p.lease_id
  WHERE p.id = payment_status_audit.payment_id AND l.landlord_id = auth.uid()
));

-- Tenants can view audit entries for their own payments
CREATE POLICY "tenants view own payment audit"
ON public.payment_status_audit
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.payments p
  JOIN public.leases l ON l.id = p.lease_id
  WHERE p.id = payment_status_audit.payment_id AND l.tenant_id = auth.uid()
));

-- Admins can view all audit entries
CREATE POLICY "admins view payment audit"
ON public.payment_status_audit
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Inserts happen via trigger using SECURITY DEFINER context; deny direct client writes
-- (no INSERT/UPDATE/DELETE policies = denied by default with RLS enabled)

-- Trigger function to log status / paid_at / method changes
CREATE OR REPLACE FUNCTION public.log_payment_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_reason text;
BEGIN
  IF v_actor IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.paid_at IS DISTINCT FROM OLD.paid_at
     OR NEW.method IS DISTINCT FROM OLD.method THEN

    v_reason := current_setting('app.payment_change_reason', true);

    INSERT INTO public.payment_status_audit (
      payment_id, changed_by, old_status, new_status,
      old_paid_at, new_paid_at, old_method, new_method, reason
    ) VALUES (
      NEW.id, v_actor, OLD.status, NEW.status,
      OLD.paid_at, NEW.paid_at, OLD.method, NEW.method, NULLIF(v_reason, '')
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER payments_audit_status_change
AFTER UPDATE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.log_payment_status_change();

-- RPC for landlord to update payment status with reason captured in audit
CREATE OR REPLACE FUNCTION public.landlord_update_payment_status(
  _payment_id uuid,
  _new_status public.payment_status,
  _method text,
  _reason text
)
RETURNS public.payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment public.payments%ROWTYPE;
  v_landlord uuid;
BEGIN
  SELECT l.landlord_id INTO v_landlord
  FROM public.payments p
  JOIN public.leases l ON l.id = p.lease_id
  WHERE p.id = _payment_id;

  IF v_landlord IS NULL THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;

  IF v_landlord <> auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Make reason available to the audit trigger
  PERFORM set_config('app.payment_change_reason', COALESCE(_reason, ''), true);

  UPDATE public.payments
  SET status = _new_status,
      method = COALESCE(_method, method),
      paid_at = CASE WHEN _new_status = 'paid' THEN COALESCE(paid_at, now()) ELSE NULL END,
      updated_at = now()
  WHERE id = _payment_id
  RETURNING * INTO v_payment;

  RETURN v_payment;
END;
$$;