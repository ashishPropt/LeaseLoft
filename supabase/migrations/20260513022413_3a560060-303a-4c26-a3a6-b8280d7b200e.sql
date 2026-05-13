CREATE OR REPLACE FUNCTION public.landlord_update_payment_status(
  _payment_id uuid,
  _new_status payment_status,
  _method text,
  _reason text,
  _paid_at timestamptz DEFAULT NULL
)
RETURNS payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_payment public.payments%ROWTYPE;
  v_landlord uuid;
  v_paid_at timestamptz;
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

  PERFORM set_config('app.payment_change_reason', COALESCE(_reason, ''), true);

  v_paid_at := CASE WHEN _new_status = 'paid' THEN COALESCE(_paid_at, now()) ELSE NULL END;

  UPDATE public.payments
  SET status = _new_status,
      method = COALESCE(_method, method),
      paid_at = v_paid_at,
      transfer_status = CASE
        WHEN _new_status = 'paid' THEN 'transferred'
        ELSE transfer_status
      END,
      transfer_error = CASE
        WHEN _new_status = 'paid' THEN NULL
        ELSE transfer_error
      END,
      transfer_created_at = CASE
        WHEN _new_status = 'paid' THEN COALESCE(transfer_created_at, v_paid_at)
        ELSE transfer_created_at
      END,
      updated_at = now()
  WHERE id = _payment_id
  RETURNING * INTO v_payment;

  RETURN v_payment;
END;
$function$;