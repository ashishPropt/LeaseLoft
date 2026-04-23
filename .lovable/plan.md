

# LeaseLoft — Updated Plan

Updates incorporated from your feedback:

- **No Google sign-in** — email/password only.
- **Invite-code-gated signup** — codes from the prototype zip will be the only way to register.
- **SMS 2FA** — required step after password sign-in, before session is considered authenticated.

## Auth flow (revised)

```text
Sign up
  Email + Password + Invite Code + Phone (E.164)
    → validate invite code (server)
    → create auth user
    → send SMS OTP via Twilio
    → verify OTP → mark phone_verified → session active

Sign in
  Email + Password
    → success → send SMS OTP to stored phone
    → /verify-2fa screen → enter 6-digit code
    → verify → session active
    → fail/expire → re-send (rate-limited)

Password reset
  Email link → /reset-password → set new password → SMS OTP step → done
```

No Google provider enabled. No magic links.

## Invite codes

- Extracted from `rental-app.zip` on first build step (file like `invite-codes.json`, `codes.csv`, or seeded constants — I'll locate it during extraction and report what I find).
- Stored in a Cloud table:

```text
invite_codes
  code            text primary key
  role            app_role            -- admin | landlord | tenant
  max_uses        int      default 1
  used_count      int      default 0
  expires_at      timestamptz null
  created_at      timestamptz default now()
```

- RLS: no client read/write. Validation runs server-side only.
- A `redeem_invite_code(code text, user_id uuid)` security-definer function:
  - locks the row, checks `used_count < max_uses` and `expires_at`, increments `used_count`, inserts the matching row into `user_roles`. Atomic.
- Signup form calls an edge function `signup-with-invite` that: validates code → creates user → redeems code → triggers SMS OTP. If any step fails, the user is rolled back.

## SMS 2FA (Twilio via Lovable connector gateway)

- Twilio connector connected during build (you'll be prompted to authorize once).
- Two edge functions:
  - `send-sms-otp` — generates 6-digit code, hashes it, stores in `otp_codes (user_id, code_hash, purpose, expires_at, attempts)` with 5-min TTL, sends via Twilio `/Messages.json`.
  - `verify-sms-otp` — checks hash, attempt counter (max 5), TTL; on success sets `phone_verified_at` on profile and issues an "mfa-passed" flag in the session (custom claim or a `mfa_sessions` table keyed by `auth.uid()` + device).
- Rate limits: 1 send / 30s, 5 sends / hour per user.
- Required at: signup, every sign-in, password reset completion, and re-verification after 30 days of inactivity.
- Recovery: backup codes generated at signup (10 single-use codes shown once, hashed in DB). Optional admin override.

## Database (auth-related slice)

```text
profiles            id (FK auth.users), email, full_name, phone_e164,
                    phone_verified_at, created_at
user_roles          id, user_id, role app_role  -- admin|landlord|tenant
invite_codes        (above)
otp_codes           id, user_id, code_hash, purpose, expires_at, attempts
mfa_sessions        user_id, device_id, verified_at, expires_at
backup_codes        id, user_id, code_hash, used_at
```

All tables RLS-on. `has_role()` security-definer helper as standard. Roles never stored on `profiles`.

## Pages added/changed

- `/signup` — email, password, phone, invite code
- `/signin` — email, password
- `/verify-2fa` — 6-digit OTP input + resend
- `/recovery` — backup-code entry
- `/reset-password` — public, post-link flow + OTP
- `<RequireAuth>` wrapper checks both session **and** valid `mfa_sessions` row; otherwise redirects to `/verify-2fa`.

## Build sequence (unchanged steps in italics)

1. *Extract `rental-app.zip` and inventory routes/components/invite codes.*
2. *Apply LeaseLoft brand tokens + logo.*
3. *Rebuild prototype screens 1:1.*
4. **Lovable Cloud + Twilio connector**: schema, RLS, `has_role`, `redeem_invite_code`, edge functions (`signup-with-invite`, `send-sms-otp`, `verify-sms-otp`), seed `invite_codes` from the zip.
5. Build the auth pages and `<RequireAuth>` MFA gate.
6. *Wire prototype data to live queries; polish, QA.*

## Things you'll be asked for during build

- Authorize the **Twilio** connector (one click).
- Choose the Twilio **From** number to send OTPs from (or I'll use a trial number for dev).
- Confirm the role to assign when an invite code in the zip doesn't specify one (default: **tenant**).

