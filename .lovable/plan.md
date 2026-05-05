## Goal

Remove both Plaid-based payment providers (`plaid_transfer`, `plaid_stripe_fc`) and replace them with a single Stripe-native provider that:

1. Uses **Stripe Financial Connections** for tenants to link their bank account (replaces Plaid Link).
2. Charges rent via **ACH Direct Debit** (`us_bank_account` PaymentIntents) — Stripe is the merchant of record on the ACH rails.

This keeps the existing `PaymentProvider` abstraction (`createLinkToken`, `exchangePublicToken`, `initiatePayment`, `parseWebhook`) so the UI and edge-function callers barely change.

## Stripe account

This is a custom rent-payments flow (not a product checkout), so we'll use the **bring-your-own-key Stripe** integration. We'll need:

- `STRIPE_SECRET_KEY` (already used by the existing `plaid_stripe_fc` provider — we'll confirm/add)
- `STRIPE_PUBLISHABLE_KEY` (new — needed in the browser to mount Financial Connections)
- `STRIPE_WEBHOOK_SECRET` (new — to verify webhook signatures)

If these aren't set, I'll request them via the secrets tool before deploying.

## What changes

### 1. New edge-function provider: `supabase/functions/_shared/payments/stripe-fc-ach.ts`

Implements `PaymentProvider` with `name: 'stripe_fc_ach'`:

- **createLinkToken** → creates a Stripe Financial Connections **Session** (`/v1/financial_connections/sessions`) with `permissions=payment_method,balances` and `filters[countries][]=US`. Returns the session's `client_secret` (we'll repurpose the `linkToken` field).
- **exchangePublicToken** → input becomes `{ accountId }` (the FC account ID returned by the browser). Server calls `/v1/payment_methods` with `type=us_bank_account` and `us_bank_account[financial_connections_account]=<acct>`, attaches it to (or creates) a Stripe **Customer** for this tenant, fetches account metadata (`bank_name`, `last4`, `subtype`) from `/v1/financial_connections/accounts/{id}`. Stores `provider_access_token = pm_xxx`, `provider_account_id = cus_xxx`.
- **initiatePayment** → creates a **PaymentIntent** (`amount`, `currency=usd`, `payment_method_types[]=us_bank_account`, `customer`, `payment_method`, `confirm=true`, `mandate_data` for ACH authorization, `idempotency_key` from payment row). Maps Stripe status → our status (`processing`, `succeeded` → `posted`, `requires_payment_method`/`canceled` → `failed`).
- **parseWebhook** → verifies signature with `STRIPE_WEBHOOK_SECRET`, handles `payment_intent.succeeded` → `paid`, `payment_intent.processing` → `processing`, `payment_intent.payment_failed` → `failed`, `charge.refunded` / dispute → `returned`.

### 2. Wire up provider selection

`supabase/functions/_shared/payments/index.ts`: add `case 'stripe_fc_ach'`. Default the `PAYMENT_PROVIDER` env to `stripe_fc_ach`. Delete the two Plaid files (`plaid-transfer.ts`, `plaid-stripe-fc.ts`).

### 3. Frontend: replace `PlaidLinkButton`

New component `src/components/payments/StripeBankLinkButton.tsx`:
- Loads `@stripe/stripe-js` (CDN or npm — we'll add the package).
- Calls `payment-link-token` to get the FC session `client_secret`.
- Calls `stripe.collectFinancialConnectionsAccounts({ clientSecret })`.
- On success, posts the selected `account.id` to `payment-exchange-token`.

Replace usages in `src/pages/tenant/PayRent.tsx` and update copy from "Plaid" → "Stripe" / "your bank".

Delete `src/components/payments/PlaidLinkButton.tsx`.

### 4. Database migration

Update the `payment_methods.provider` CHECK constraint to allow `stripe_fc_ach` (and drop the old Plaid values, or keep them for historical rows — we'll keep them but allow the new value):

```sql
ALTER TABLE public.payment_methods DROP CONSTRAINT payment_methods_provider_check;
ALTER TABLE public.payment_methods ADD CONSTRAINT payment_methods_provider_check
  CHECK (provider IN ('stripe_fc_ach', 'plaid_transfer', 'plaid_stripe_fc'));
```

(Existing rows keep working in read-only mode but new links will only use `stripe_fc_ach`.)

### 5. Webhook URL

The existing `payment-webhook` function URL stays the same. After deploy you'll need to register it in your Stripe dashboard for the events listed above and paste the signing secret as `STRIPE_WEBHOOK_SECRET`.

### 6. Secrets cleanup

We'll leave `PLAID_*` secrets in place (harmless) — you can delete them from Cloud settings later.

## Open questions before I implement

1. **Stripe account**: do you already have a Stripe account ready, and do you want to provide `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY` / `STRIPE_WEBHOOK_SECRET` now? (Required before I can deploy.)
2. **Existing linked banks**: any tenant currently linked via Plaid will need to re-link with Stripe. OK to leave their old `payment_methods` rows as `revoked` on first load, or just leave them dormant?

Once you confirm, I'll implement everything in one pass.