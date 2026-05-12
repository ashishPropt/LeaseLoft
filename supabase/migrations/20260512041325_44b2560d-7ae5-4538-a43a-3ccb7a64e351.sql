
ALTER TABLE public.leases
  ADD COLUMN IF NOT EXISTS late_fee_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS late_fee_grace_days integer NOT NULL DEFAULT 0;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS late_fee_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS late_fee_applied_at timestamptz;

CREATE OR REPLACE FUNCTION public.landlord_apply_late_fee(_payment_id uuid)
RETURNS public.payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment public.payments%ROWTYPE;
  v_lease public.leases%ROWTYPE;
  v_today date := (now() AT TIME ZONE 'utc')::date;
BEGIN
  SELECT p.* INTO v_payment FROM public.payments p WHERE p.id = _payment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;

  SELECT l.* INTO v_lease FROM public.leases l WHERE l.id = v_payment.lease_id;
  IF v_lease.landlord_id <> auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF v_payment.status <> 'pending' OR v_payment.paid_at IS NOT NULL THEN
    RAISE EXCEPTION 'Late fee can only be applied to unpaid pending payments';
  END IF;

  IF COALESCE(v_lease.late_fee_amount, 0) <= 0 THEN
    RAISE EXCEPTION 'No late fee amount configured on this lease';
  END IF;

  IF v_today <= v_payment.due_date + COALESCE(v_lease.late_fee_grace_days, 0) THEN
    RAISE EXCEPTION 'Payment is not yet past the grace period';
  END IF;

  IF v_payment.late_fee_applied_at IS NOT NULL THEN
    RAISE EXCEPTION 'Late fee already applied to this payment';
  END IF;

  PERFORM set_config('app.payment_change_reason',
    'Late fee applied: ' || v_lease.late_fee_amount::text, true);

  UPDATE public.payments
  SET amount = amount + v_lease.late_fee_amount,
      late_fee_amount = v_lease.late_fee_amount,
      late_fee_applied_at = now(),
      updated_at = now()
  WHERE id = _payment_id
  RETURNING * INTO v_payment;

  RETURN v_payment;
END;
$$;
