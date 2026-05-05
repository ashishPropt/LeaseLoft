ALTER TABLE public.payment_methods DROP CONSTRAINT IF EXISTS payment_methods_provider_check;
ALTER TABLE public.payment_methods ADD CONSTRAINT payment_methods_provider_check
  CHECK (provider IN ('stripe_fc_ach', 'plaid_transfer', 'plaid_stripe_fc'));