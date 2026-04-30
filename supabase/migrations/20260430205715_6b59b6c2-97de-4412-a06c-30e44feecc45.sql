-- Expire seeded demo invite codes so they can no longer be redeemed
UPDATE public.invite_codes
SET expires_at = now() - interval '1 second'
WHERE code IN ('LL-2026-XJ4K', 'TN-2026-A7B3');