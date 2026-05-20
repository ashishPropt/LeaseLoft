# Plan: Per-plan unit limits

Admins configure a max number of units per Stripe price ID. When a landlord tries to add a unit, the system checks their current subscription's price ID against the cap and blocks the action if it would exceed the limit. Landlords without an active subscription or with a price ID that has no configured cap are blocked from creating units.

## How it works

- **Counting**: total units across all of a landlord's properties.
- **No subscription / unmapped price**: blocked from creating new units (existing units untouched).
- **Where admins configure it**: new page `Admin → Plan Limits`, listed in the Admin sidebar.

## Changes

### Database

New table `plan_unit_limits`:
- `stripe_price_id` (text, unique) — the `price_…` ID
- `max_units` (int) — cap
- `label` (text, optional) — admin-facing name like "Starter / 5 units"

RLS:
- Admins: full read/write
- Authenticated users: read-only (needed so the landlord UI can show "X of Y used")

### Admin UI

New page `src/pages/admin/PlanLimits.tsx` + route + sidebar entry in `AdminLayout`:
- Table of existing mappings with inline edit, add, delete
- Validation: price ID must start with `price_`, `max_units >= 0`

### Landlord enforcement

Server-side (authoritative):
- New trigger `enforce_unit_limit` on `units` BEFORE INSERT:
  - Look up the property's owner → their `profiles.stripe_subscription_status` + `subscription_price_id`
  - If status not in (`active`, `trialing`) → raise exception "Active subscription required to add units."
  - Look up `plan_unit_limits.max_units` for that price → if missing, raise "Your plan does not allow adding units. Contact support."
  - Count existing units for that owner → if `>= max_units`, raise "Plan limit reached (X of Y units used). Upgrade your plan to add more."

Client-side (UX only):
- In `src/pages/landlord/PropertyDetail.tsx`, before opening "Add unit" dialog, fetch owner's price + limit + current count and show a friendly message + disabled button when at cap. Show toast with the trigger's error message on insert failure as backup.
- Optional: small "X / Y units used" indicator in `LandlordProperties.tsx` header.

### Out of scope

- No change to subscription flow itself or `landlord-subscription-checkout`.
- No retroactive enforcement on landlords already over a newly-set cap (existing units stay; only new inserts blocked).
- No per-property limits.

## Technical notes

- Trigger uses `SECURITY DEFINER` so it can read `profiles` regardless of the inserting user.
- `plan_unit_limits` keyed by `stripe_price_id` (not Lovable user) so it's plan-global.
- Admin page mirrors the look and behavior of `src/pages/admin/Invites.tsx` / existing admin tables.
