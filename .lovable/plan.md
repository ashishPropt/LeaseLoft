## Change

Replace the explicit `payment_method_types[]=us_bank_account` parameter on the PaymentIntent with Stripe's `automatic_payment_methods` so Stripe selects the right payment method type from what's enabled on the connected account.

## Why this helps

The current Stripe error comes from explicitly requesting `us_bank_account` on a connected account where that type isn't activated. With `automatic_payment_methods[enabled]=true` and `automatic_payment_methods[allow_redirects]=never`, Stripe accepts whatever the attached `payment_method` actually is (the FC-linked `us_bank_account` PaymentMethod) without forcing us to whitelist the type up front. We avoid the `payment_intent_invalid_parameter` error path.

Note: this only changes how the PaymentIntent is created — the connected account still needs the `us_bank_account_payments` capability to actually settle ACH. If the capability is missing, Stripe will now return a clearer "capability not active" error from confirmation, which we'll surface verbatim to the tenant.

## File touched

- `supabase/functions/_shared/payments/stripe-fc-ach.ts` — in `initiatePayment`, swap:
  - Remove: `'payment_method_types[]': 'us_bank_account'`
  - Add: `'automatic_payment_methods[enabled]': 'true'`, `'automatic_payment_methods[allow_redirects]': 'never'`
  - Keep `payment_method`, `confirm`, mandate data, customer, metadata, and the existing idempotency key as-is.

No DB changes. No frontend changes. Only the one edge function file is updated and redeployed.
