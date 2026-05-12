## Goal

Move rent payments (ACH via Financial Connections and card via Checkout) from the current "platform charge + transfer" model to **direct charges on the landlord's connected account**. The PaymentIntent / Checkout Session is created while authenticated as the connected account (`Stripe-Account: <acct_xxx>` header), so funds settle directly on the landlord — no platform Transfer step.

## Behavior changes

- For each payment, look up the lease's landlord and their `stripe_connect_account_id`. Reject the payment if the landlord isn't fully onboarded (`charges_enabled = true`).
- All Stripe API calls for that payment (Customer, Financial Connections session, PaymentMethod attach, PaymentIntent, Checkout Session) are made with the `Stripe-Account` header set to the landlord's connected account.
- No platform `Transfer` is created. `createTransferForPayment` and its call sites are removed from the payment flows. The helper file is left in place but unused (or deleted).
- Existing `payment_methods` rows are platform-scoped and won't work as direct-charge methods. They'll be marked `revoked` and tenants will be prompted to re-link their bank.
- Webhooks: events fire on the connected account. The webhook handler accepts events that include an `account` field and updates the matching payment by `provider_transfer_id` (PaymentIntent id). User will add a Connect webhook endpoint in Stripe Dashboard pointing to the existing `/payment-webhook` URL.

## Implementation

### Database
Migration to revoke all existing linked bank accounts so tenants re-link under the new flow:
- `UPDATE public.payment_methods SET status = 'revoked' WHERE status = 'active';`
- Add column `payment_methods.connected_account_id text` (the landlord acct id the PM lives on) so future operations know which account to authenticate as.
- Add column `payments.connected_account_id text` to record where each charge was created (helps webhook routing and reconciliation).

### Shared payments lib (`supabase/functions/_shared/payments/`)
- Update `stripe()` / `stripeGet()` helpers in `stripe-fc-ach.ts` to optionally take a `stripeAccount` param and set the `Stripe-Account` request header when present.
- Update `PaymentProvider` interface so `createLinkToken`, `exchangePublicToken`, and `initiatePayment` accept a `stripeAccount` (connected account id).
- `createLinkToken`: create the Customer + Financial Connections Session on the connected account.
- `exchangePublicToken`: fetch FC account, create + attach the `us_bank_account` PaymentMethod, all on the connected account; return the connected account id alongside `accessToken` / `providerAccountId`.
- `initiatePayment`: create the PaymentIntent on the connected account (no `transfer_data`, no `application_fee_amount`).
- `parseWebhook`: accept the optional top-level `account` field on the event payload and pass it through on the returned `WebhookEvent` so the handler can record which account the charge belongs to.

### Edge functions
- `payment-link-token`: resolve tenant's active lease → landlord's connected account; require `charges_enabled`; pass `stripeAccount` into `createLinkToken`. Return the connected account id to the client (needed by Stripe.js to scope `collectFinancialConnectionsAccounts`).
- `payment-exchange-token`: pass `stripeAccount` into `exchangePublicToken`; persist `connected_account_id` on the new `payment_methods` row.
- `payment-initiate`: load the payment method's `connected_account_id`; pass it to `initiatePayment`; persist it on the `payments` row. Remove the `createTransferForPayment` call.
- `payment-card-checkout`: resolve landlord's connected account from `payment.lease.landlord_id`; require `charges_enabled`; create the Stripe Customer and the Checkout Session **on the connected account** (`Stripe-Account` header). Use a per-landlord stripe customer mapping (new column `profiles.stripe_customer_id_per_landlord jsonb` keyed by `acct_xxx → cus_xxx`, since one tenant maps to one customer per connected account). Persist `connected_account_id` on the payment row. Remove the platform-side transfer dependency.
- `payment-webhook`: parse the optional `account` field on the incoming event; update the matching payment by `provider_transfer_id`; do NOT call `createTransferForPayment`.

### Frontend
- `StripeBankLinkButton`: read the connected account id returned by `payment-link-token` and pass it to `loadStripe(publishableKey, { stripeAccount })` so `collectFinancialConnectionsAccounts` runs in the connected-account context. Cache one Stripe instance per connected account.
- `tenant/PayRent.tsx`: no UX change beyond surfacing a clearer error if the landlord's payouts aren't enabled (`Landlord cannot accept payments yet`). Existing legacy `payment_methods` will appear as revoked, so tenants will see the "link your bank" CTA again.

## Webhook setup (manual, by user)

In Stripe Dashboard → Developers → Webhooks → **Connect** endpoint:
- URL: existing `…/functions/v1/payment-webhook`
- Events: `payment_intent.succeeded`, `payment_intent.processing`, `payment_intent.payment_failed`, `payment_intent.canceled`, `charge.refunded`, `charge.dispute.created`
- Reuse the same `STRIPE_WEBHOOK_SECRET` if Stripe assigns the same one, or add a second secret env var if it differs (the handler will accept either).

## Out of scope

- No platform application fee (per your decision).
- `stripe-transfer.ts` is no longer called from the rent flows; we'll leave the file untouched to avoid churn but it can be deleted in a follow-up.
- Subscription billing (landlord SaaS subscription) is unrelated and stays on the platform account.
