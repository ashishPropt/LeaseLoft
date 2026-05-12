
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS connected_account_id text;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS connected_account_id text;
UPDATE public.payment_methods SET status = 'revoked' WHERE status = 'active';
