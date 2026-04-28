-- Extend payment_status enum
ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'processing';
ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'failed';
ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'returned';

-- payment_methods table
CREATE TABLE public.payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  landlord_id uuid NOT NULL,
  provider text NOT NULL CHECK (provider IN ('plaid_transfer','plaid_stripe_fc')),
  provider_account_id text NOT NULL,
  provider_access_token text NOT NULL,
  bank_name text,
  account_mask text,
  account_type text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

-- Tenants: view/insert/delete own (but NEVER read access token via *)
CREATE POLICY "tenants view own payment methods"
  ON public.payment_methods FOR SELECT
  USING (auth.uid() = tenant_id);

CREATE POLICY "tenants insert own payment methods"
  ON public.payment_methods FOR INSERT
  WITH CHECK (auth.uid() = tenant_id);

CREATE POLICY "tenants delete own payment methods"
  ON public.payment_methods FOR DELETE
  USING (auth.uid() = tenant_id);

CREATE POLICY "tenants update own payment methods"
  ON public.payment_methods FOR UPDATE
  USING (auth.uid() = tenant_id)
  WITH CHECK (auth.uid() = tenant_id);

-- Landlords: read for their tenants
CREATE POLICY "landlords view connected payment methods"
  ON public.payment_methods FOR SELECT
  USING (landlord_has_lease_with_tenant(auth.uid(), tenant_id));

-- Admins
CREATE POLICY "admins view payment methods"
  ON public.payment_methods FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Revoke direct access to access token from anon/authenticated; keep only service_role
REVOKE SELECT (provider_access_token) ON public.payment_methods FROM anon, authenticated;

CREATE TRIGGER set_payment_methods_updated_at
  BEFORE UPDATE ON public.payment_methods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_payment_methods_tenant ON public.payment_methods(tenant_id);
CREATE INDEX idx_payment_methods_landlord ON public.payment_methods(landlord_id);

-- Extend payments
ALTER TABLE public.payments
  ADD COLUMN provider text,
  ADD COLUMN provider_transfer_id text,
  ADD COLUMN payment_method_id uuid REFERENCES public.payment_methods(id) ON DELETE SET NULL,
  ADD COLUMN failure_reason text;

CREATE INDEX idx_payments_provider_transfer ON public.payments(provider_transfer_id) WHERE provider_transfer_id IS NOT NULL;