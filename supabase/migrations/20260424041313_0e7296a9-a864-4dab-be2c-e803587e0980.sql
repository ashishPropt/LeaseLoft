CREATE OR REPLACE FUNCTION public.redeem_invite_code(_code text, _user_id uuid)
RETURNS TABLE(success boolean, role public.app_role, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_entry public.invite_codes%ROWTYPE;
BEGIN
  SELECT *
  INTO v_entry
  FROM public.invite_codes
  WHERE code = upper(trim(_code))
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::public.app_role, 'Invite code not found';
    RETURN;
  END IF;

  IF v_entry.used_count >= v_entry.max_uses THEN
    RETURN QUERY SELECT FALSE, NULL::public.app_role, 'Invite code already used';
    RETURN;
  END IF;

  IF v_entry.expires_at IS NOT NULL AND v_entry.expires_at < now() THEN
    RETURN QUERY SELECT FALSE, NULL::public.app_role, 'Invite code expired';
    RETURN;
  END IF;

  UPDATE public.invite_codes
  SET used_count = used_count + 1,
      used_by = _user_id,
      used_at = now()
  WHERE code = v_entry.code;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, v_entry.role)
  ON CONFLICT ON CONSTRAINT user_roles_user_id_role_key DO NOTHING;

  RETURN QUERY SELECT TRUE, v_entry.role, 'OK';
END;
$$;