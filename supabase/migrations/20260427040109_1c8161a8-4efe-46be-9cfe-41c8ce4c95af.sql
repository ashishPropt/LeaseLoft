-- Ensure only one active lease per unit at a time
CREATE UNIQUE INDEX IF NOT EXISTS leases_one_active_per_unit
  ON public.leases (unit_id)
  WHERE status = 'active';