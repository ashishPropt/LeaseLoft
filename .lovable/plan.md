

# LeaseLoft — Ready to Build

Confirmed:
- **Cloud region**: Americas
- **No LLM/AI** in this phase (can add later)
- **Custom domain**: noted for post-launch; build proceeds on the preview URL

## Build sequence (locked)

1. **Enable Lovable Cloud** (Americas) — provisions auth, Postgres, storage, edge functions.
2. **Brand foundation**
   - LeaseLoft HSL tokens in `index.css` (light + dark)
   - Extend `tailwind.config.ts` with `primary`, `primary-deep`, `primary-light`, `primary-tint`, `surface-dark`, `neutral`
   - `<Logo />` + `<LogoMark />` components, favicon, `index.html` meta
3. **Database + RLS**
   - Tables: `profiles`, `user_roles`, `invite_codes`, `otp_codes`, `mfa_sessions`, `backup_codes`, plus app tables (`properties`, `units`, `tenants`, `leases`, `payments`, `maintenance_requests`, `documents`)
   - `app_role` enum (`admin`, `landlord`, `tenant`)
   - `has_role()` security-definer function; RLS on every table
   - `redeem_invite_code()` security-definer function (atomic)
   - Seed `invite_codes` from the prototype zip
4. **Twilio connector + edge functions**
   - Authorize Twilio (one-click prompt during build)
   - `signup-with-invite`, `send-sms-otp`, `verify-sms-otp`
   - Rate limits: 1 send / 30s, 5 / hour; OTP TTL 5 min; max 5 attempts
5. **Auth pages + MFA gate**
   - `/signin`, `/signup`, `/verify-2fa`, `/recovery`, `/reset-password`
   - `<RequireAuth>` checks session **and** valid `mfa_sessions` row
   - Backup codes shown once at signup (10 single-use, hashed)
6. **Rebuild prototype screens 1:1**
   - All ~25 LeaseLogix screens recreated as React + Tailwind + shadcn/ui
   - Tenant, Landlord, Admin role-gated routes
7. **Wire to live data**
   - Replace mocks with `@tanstack/react-query` hooks against Supabase
   - Empty states, loading skeletons, toast feedback
8. **QA pass** at 1259px and mobile; clean console + network

## Prompts you'll see during the build

- Authorize **Twilio** connector
- Choose Twilio **From** number (or use trial number for dev)
- Confirm default role when an invite code doesn't specify one (default: **tenant**)

## Post-launch (not in this phase)

- Connect custom domain via Project → Settings → Domains
- Add Lovable AI for any AI-powered features later

Approve to start with Step 1 (enable Cloud).

