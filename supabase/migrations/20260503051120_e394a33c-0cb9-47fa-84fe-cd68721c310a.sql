DELETE FROM public.payments
WHERE lease_id IN (
  SELECT l.id FROM public.leases l
  WHERE NOT EXISTS (
    SELECT 1 FROM public.leases l2
    WHERE l2.unit_id = l.unit_id AND l2.status = 'active'
  )
);