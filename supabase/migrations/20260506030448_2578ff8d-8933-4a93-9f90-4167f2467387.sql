ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS destination_account_id text,
  ADD COLUMN IF NOT EXISTS transfer_id text,
  ADD COLUMN IF NOT EXISTS transfer_status text,
  ADD COLUMN IF NOT EXISTS transfer_error text,
  ADD COLUMN IF NOT EXISTS transfer_created_at timestamptz;