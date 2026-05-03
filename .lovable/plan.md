# Email Notifications for LeaseLoft

## Goal

Send branded app emails from `leaseloft-support@bizpioneers.net` for:
1. **Thank-you** — when someone submits an invite request
2. **Approved** — when an admin approves a request (delivers the invite code)
3. **Rejected** — when an admin rejects a request
4. Foundation for future notification emails (welcome, payment receipts, maintenance updates, etc.)

## Approach

Use Lovable Cloud's built-in email infrastructure (queued, retried, with bounce/suppression handling). No third-party API key required.

### Step 1 — Set up the sender domain

You'll need to set up `bizpioneers.net` (or a subdomain like `notify.bizpioneers.net`) as a verified sender. This is a one-time DNS step done through a guided dialog — you'll get NS records to add at your domain registrar.

Once verified, emails will send from `leaseloft-support@bizpioneers.net`.

### Step 2 — Build the email infrastructure

Behind the scenes, this provisions a durable email queue with automatic retries, suppression list (bounces/unsubscribes), send log, and a one-click unsubscribe page — all on your Lovable Cloud backend.

### Step 3 — Create three branded email templates

Styled to match LeaseLoft (same colors, typography, footer):

| Template | Trigger | Contents |
|---|---|---|
| `invite-request-received` | After invite request submitted | Thanks, what to expect, 1–2 business day SLA |
| `invite-request-approved` | Admin clicks Approve | Their single-use invite code + sign-up link + 30-day expiry note |
| `invite-request-rejected` | Admin clicks Reject | Polite decline message, contact path |

### Step 4 — Wire up the triggers

- **Invite request submitted** → fire from the `submit-invite-request` edge function (server-side, so the user gets the thank-you even before the page redirects).
- **Approved / Rejected** → fire from `src/pages/admin/Requests.tsx` after the existing DB updates succeed, using an idempotency key tied to the request ID so retries can't duplicate sends.

### Step 5 — Unsubscribe page

A branded `/unsubscribe` page is added so the system-managed unsubscribe footer in each email links back to your app (not a raw URL).

## Technical notes

- Sender domain: `bizpioneers.net` with delegated subdomain (default `notify.bizpioneers.net`) — the `From:` header will display `leaseloft-support@bizpioneers.net` via the display-from-root option during setup.
- Templates live under `supabase/functions/_shared/transactional-email-templates/` as React Email components.
- All sends go through the single `send-transactional-email` edge function with `templateName` + `templateData` + `idempotencyKey`.
- Approved-email payload includes the generated invite code; the code stays stored in `invite_requests.generated_invite_code` only as long as needed for admin reference.
- No changes to auth emails (Supabase defaults remain) — scope is app notifications only.

## What I'll need from you

- Confirm the domain to verify: **`bizpioneers.net`** (recommended subdomain `notify.bizpioneers.net`, with From: shown as `leaseloft-support@bizpioneers.net`).
- After you approve this plan, I'll open the email-domain setup dialog where you'll paste 2 NS records into your DNS provider. Verification typically takes minutes to a few hours.

## Out of scope (for now)

- Branded auth emails (password reset, 2FA) — can be added later as a follow-up.
- Bulk/marketing emails — not supported on this infrastructure by design.
