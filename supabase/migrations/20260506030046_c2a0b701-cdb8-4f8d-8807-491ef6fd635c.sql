ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_connect_account_id text,
  ADD COLUMN IF NOT EXISTS stripe_connect_charges_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_connect_payouts_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_connect_details_submitted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_connect_updated_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_stripe_connect_account_id_key
  ON public.profiles (stripe_connect_account_id)
  WHERE stripe_connect_account_id IS NOT NULL;