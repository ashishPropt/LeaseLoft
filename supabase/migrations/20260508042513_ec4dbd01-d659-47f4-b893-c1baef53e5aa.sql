ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS stripe_pricing_table_id text;