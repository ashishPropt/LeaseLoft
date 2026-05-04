ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS sms_2fa_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sms_2fa_consent_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS sms_2fa_consent_source text;