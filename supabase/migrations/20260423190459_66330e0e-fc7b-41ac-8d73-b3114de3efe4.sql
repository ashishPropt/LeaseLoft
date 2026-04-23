-- Explicit deny: only service role can touch OTP codes
CREATE POLICY "deny all client access" ON public.otp_codes FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "deny all client access" ON public.backup_codes FOR ALL USING (false) WITH CHECK (false);