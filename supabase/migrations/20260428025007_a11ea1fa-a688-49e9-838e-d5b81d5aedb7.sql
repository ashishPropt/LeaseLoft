
-- Function: generate pending payment rows for each 1st-of-month due date within a lease term.
-- Skips months that already have a payment row (any status), so it's safe to re-run and
-- safe to call after rent/date changes without duplicating or destroying paid history.
CREATE OR REPLACE FUNCTION public.generate_lease_payments(_lease_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lease       public.leases%ROWTYPE;
  v_first_due   date;
  v_cursor      date;
BEGIN
  SELECT * INTO v_lease FROM public.leases WHERE id = _lease_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- First due date is the 1st of the lease's start month, or 1st of next month
  -- if the lease starts after the 1st.
  IF EXTRACT(DAY FROM v_lease.start_date) = 1 THEN
    v_first_due := date_trunc('month', v_lease.start_date)::date;
  ELSE
    v_first_due := (date_trunc('month', v_lease.start_date) + INTERVAL '1 month')::date;
  END IF;

  v_cursor := v_first_due;

  WHILE v_cursor <= v_lease.end_date LOOP
    INSERT INTO public.payments (lease_id, amount, due_date, status)
    SELECT v_lease.id, v_lease.rent_amount, v_cursor, 'pending'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.payments p
      WHERE p.lease_id = v_lease.id AND p.due_date = v_cursor
    );
    v_cursor := (v_cursor + INTERVAL '1 month')::date;
  END LOOP;
END;
$$;

-- Trigger function: regenerate schedule on lease insert or when dates/rent change.
CREATE OR REPLACE FUNCTION public.leases_sync_payments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.generate_lease_payments(NEW.id);
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.start_date IS DISTINCT FROM OLD.start_date
       OR NEW.end_date   IS DISTINCT FROM OLD.end_date
       OR NEW.rent_amount IS DISTINCT FROM OLD.rent_amount THEN

      -- Remove only future, unpaid pending rows that fall outside the new window
      -- or are no longer aligned. Preserve any paid/failed history.
      DELETE FROM public.payments p
      WHERE p.lease_id = NEW.id
        AND p.status = 'pending'
        AND p.paid_at IS NULL
        AND (
          p.due_date < CASE WHEN EXTRACT(DAY FROM NEW.start_date) = 1
                            THEN date_trunc('month', NEW.start_date)::date
                            ELSE (date_trunc('month', NEW.start_date) + INTERVAL '1 month')::date
                       END
          OR p.due_date > NEW.end_date
        );

      -- Update amount on remaining unpaid pending rows so rent changes propagate.
      UPDATE public.payments
      SET amount = NEW.rent_amount
      WHERE lease_id = NEW.id
        AND status = 'pending'
        AND paid_at IS NULL;

      PERFORM public.generate_lease_payments(NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS leases_sync_payments_trg ON public.leases;
CREATE TRIGGER leases_sync_payments_trg
AFTER INSERT OR UPDATE ON public.leases
FOR EACH ROW EXECUTE FUNCTION public.leases_sync_payments();

-- Backfill: generate missing schedule rows for every existing lease.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.leases LOOP
    PERFORM public.generate_lease_payments(r.id);
  END LOOP;
END $$;

-- Lock down direct execution from anonymous clients.
REVOKE EXECUTE ON FUNCTION public.generate_lease_payments(uuid) FROM PUBLIC, anon;
