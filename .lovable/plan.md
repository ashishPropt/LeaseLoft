# Plan: Plaid Transfer ACH with Provider Abstraction

## Summary

Implement ACH rent payments using **Plaid Transfer** as the active provider, behind a `PaymentProvider` interface so we can swap to **Plaid + Stripe Financial Connections** later by flipping the `PAYMENT_PROVIDER` env var. All money-movement code lives behind the interface — no provider-specific code in UI or unrelated edge functions.

---

## Architecture

```text
┌─────────────────────────────────────────────────────┐
│  Tenant UI (PayRent.tsx)                            │
│   - Click "Link bank" → opens Plaid Link            │
│   - Click "Pay" → calls payment-initiate function   │
└────────────────────┬────────────────────────────────┘
                     │ supabase.functions.invoke()
                     ▼
┌─────────────────────────────────────────────────────┐
│  Edge functions (provider-agnostic callers)         │
│   - payment-link-token                              │
│   - payment-exchange-token                          │
│   - payment-initiate                                │
│   - payment-webhook                                 │
└────────────────────┬────────────────────────────────┘
                     │ getProvider(env.PAYMENT_PROVIDER)
                     ▼
┌─────────────────────────────────────────────────────┐
│  PaymentProvider interface (_shared/payments/)      │
│   ┌─────────────────────┐  ┌──────────────────────┐ │
│   │ PlaidTransferProv.  │  │ PlaidStripeFCProv.   │ │
│   │ (active)            │  │ (stub for now)       │ │
│   └─────────────────────┘  └──────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

---

## Database Migration

**New table `payment_methods`** (provider-agnostic saved bank accounts):
- `id`, `tenant_id` (uuid), `landlord_id` (uuid)
- `provider` text (`plaid_transfer` | `plaid_stripe_fc`)
- `provider_account_id` text — opaque per-provider id (Plaid `account_id`, or Stripe `pm_...`)
- `provider_access_token` text — encrypted at rest via column not exposed by RLS to client
- `bank_name`, `account_mask` (last 4), `account_type` (`checking`/`savings`)
- `status` (`active` | `revoked`), `created_at`
- RLS: tenant can SELECT/INSERT/DELETE own; landlord can SELECT for their leases' tenants; service role full access

**Extend `payments` table**:
- `provider` text nullable
- `provider_transfer_id` text nullable — opaque transfer/payment intent id
- `payment_method_id` uuid nullable → references `payment_methods.id`
- `failure_reason` text nullable
- New status enum values: add `processing`, `failed`, `returned` to `payment_status`

---

## PaymentProvider Interface

`supabase/functions/_shared/payments/types.ts`:
```ts
export interface PaymentProvider {
  name: 'plaid_transfer' | 'plaid_stripe_fc';
  createLinkToken(input: { userId: string }): Promise<{ linkToken: string }>;
  exchangePublicToken(input: { publicToken: string; accountId: string }):
    Promise<{ accessToken: string; providerAccountId: string; bankName: string; mask: string; accountType: string }>;
  initiatePayment(input: {
    accessToken: string; providerAccountId: string;
    amountCents: number; description: string; idempotencyKey: string;
    userId: string; userName: string;
  }): Promise<{ providerTransferId: string; status: 'processing' | 'posted' | 'failed' }>;
  parseWebhook(req: Request): Promise<{
    providerTransferId: string;
    newStatus: 'processing' | 'paid' | 'failed' | 'returned';
    failureReason?: string;
  } | null>;
}
```

`supabase/functions/_shared/payments/index.ts` — `getProvider()` reads `Deno.env.get('PAYMENT_PROVIDER')` (default `plaid_transfer`) and returns the matching impl.

`plaid-transfer.ts` — full implementation calling Plaid `/link/token/create`, `/item/public_token/exchange`, `/transfer/authorization/create`, `/transfer/create`, and `/transfer/event/sync` for webhooks.

`plaid-stripe-fc.ts` — stub that throws `NotImplementedError`. Documents the swap path. Filled in later if Plaid Transfer pricing falls through.

---

## Edge Functions (4)

1. **`payment-link-token`** — auth required; returns Plaid Link token for the current user.
2. **`payment-exchange-token`** — auth required; takes `{ public_token, account_id }`, exchanges via provider, inserts into `payment_methods`. Service role used for insert (access token never returned to client).
3. **`payment-initiate`** — auth required; takes `{ payment_id, payment_method_id }`. Validates tenant owns both. Calls provider `initiatePayment` with `payment_id` as idempotency key. Updates `payments.status` to `processing` and stores `provider_transfer_id`.
4. **`payment-webhook`** — public (no JWT); verifies Plaid webhook signature; calls `provider.parseWebhook`; updates the matching `payments` row by `provider_transfer_id`.

All four import from `_shared/payments` — none reference Plaid directly.

---

## Frontend Changes

**`src/lib/usePaymentMethods.ts`** — hook to list/refresh `payment_methods` for the current tenant.

**`src/components/payments/PlaidLinkButton.tsx`** — loads Plaid Link script, calls `payment-link-token`, opens Link, on success calls `payment-exchange-token`. Single component; later swap to Stripe FC just means swapping which SDK script this loads (or replace the component entirely — UI surface is one file).

**`src/pages/tenant/PayRent.tsx`** — replace the manual "record a payment" form with:
- If no saved bank: show `<PlaidLinkButton />` "Link your bank to pay rent"
- If saved bank(s): show selector + amount + "Pay $X" button that calls `payment-initiate`
- Show pending/processing state if `payments.status = 'processing'` (poll or show static "We'll email you when it clears")

Method selector removed (only ACH). The "demo, no real charge" note replaced with sandbox notice when `PAYMENT_PROVIDER` env is sandbox.

---

## Secrets Required

I'll request these via `add_secret` after you approve:
1. `PLAID_CLIENT_ID`
2. `PLAID_SECRET` (sandbox secret to start)
3. `PLAID_ENV` (`sandbox` | `production`)
4. `PLAID_WEBHOOK_SECRET` (for verifying webhooks; optional in sandbox)
5. `PAYMENT_PROVIDER` (`plaid_transfer` — sets the active provider)

You get these from the Plaid Dashboard → Team Settings → Keys after creating a free Plaid account. Sandbox works immediately with no sales call.

---

## Build Order

1. DB migration (`payment_methods` table + `payments` extensions + status enum values).
2. Request the 5 secrets — wait for you to paste them.
3. `_shared/payments/` interface + Plaid Transfer impl + Stripe FC stub.
4. Four edge functions.
5. `PlaidLinkButton` component + `usePaymentMethods` hook.
6. Rewrite `PayRent.tsx`.
7. Smoke test with Plaid sandbox credentials (`user_good` / `pass_good`, routing `011401533`).

---

## What Stays the Same If We Switch Later

When you swap to Plaid + Stripe FC:
- Frontend: only `PlaidLinkButton.tsx` changes (or gets a sibling `StripeFCButton.tsx` switched by env)
- Edge functions: zero changes — they call the interface
- DB schema: zero changes — `provider` column already discriminates
- New work: implement `plaid-stripe-fc.ts` (one file, ~200 lines)

---

## Out of Scope (this pass)

- Production Plaid pricing call (you handle with Plaid sales)
- Auto-pay / scheduled payments
- Landlord-initiated refunds UI (interface supports it; UI later)
- Migration script to convert Plaid tokens → Stripe tokens (only needed if we actually switch)

---

## Approve to proceed

On approval I'll start with the DB migration, then request the 5 Plaid secrets.