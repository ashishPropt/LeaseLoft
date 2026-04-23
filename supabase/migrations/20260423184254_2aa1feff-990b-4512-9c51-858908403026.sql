-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin', 'landlord', 'tenant');
CREATE TYPE public.lease_status AS ENUM ('draft', 'active', 'ended', 'terminated');
CREATE TYPE public.payment_status AS ENUM ('pending', 'paid', 'failed', 'refunded');
CREATE TYPE public.maintenance_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');
CREATE TYPE public.maintenance_priority AS ENUM ('low', 'medium', 'high', 'urgent');

-- ============ TIMESTAMP TRIGGER ============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  first_name TEXT,
  last_name TEXT,
  phone_e164 TEXT,
  phone_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role security definer
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- Profiles RLS
CREATE POLICY "users view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "admins view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- User roles RLS
CREATE POLICY "users view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "admins manage roles" ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ INVITE CODES ============
CREATE TABLE public.invite_codes (
  code TEXT PRIMARY KEY,
  role public.app_role NOT NULL,
  max_uses INT NOT NULL DEFAULT 1,
  used_count INT NOT NULL DEFAULT 0,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  property TEXT,
  note TEXT,
  created_by_name TEXT,
  expires_at TIMESTAMPTZ,
  used_by UUID REFERENCES auth.users(id),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;
-- No client policies: only service role (edge functions) can read/write
CREATE POLICY "admins view invites" ON public.invite_codes FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage invites" ON public.invite_codes FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- redeem_invite_code: atomic redemption
CREATE OR REPLACE FUNCTION public.redeem_invite_code(_code TEXT, _user_id UUID)
RETURNS TABLE (success BOOLEAN, role public.app_role, message TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_entry public.invite_codes%ROWTYPE;
BEGIN
  SELECT * INTO v_entry FROM public.invite_codes WHERE code = upper(trim(_code)) FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::public.app_role, 'Invite code not found'; RETURN;
  END IF;
  IF v_entry.used_count >= v_entry.max_uses THEN
    RETURN QUERY SELECT FALSE, NULL::public.app_role, 'Invite code already used'; RETURN;
  END IF;
  IF v_entry.expires_at IS NOT NULL AND v_entry.expires_at < now() THEN
    RETURN QUERY SELECT FALSE, NULL::public.app_role, 'Invite code expired'; RETURN;
  END IF;

  UPDATE public.invite_codes
    SET used_count = used_count + 1, used_by = _user_id, used_at = now()
    WHERE code = v_entry.code;

  INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, v_entry.role)
    ON CONFLICT (user_id, role) DO NOTHING;

  RETURN QUERY SELECT TRUE, v_entry.role, 'OK';
END;
$$;

-- ============ OTP CODES ============
CREATE TABLE public.otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'login',
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_otp_user ON public.otp_codes(user_id, created_at DESC);
-- No client access

-- ============ MFA SESSIONS ============
CREATE TABLE public.mfa_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  UNIQUE (user_id, device_id)
);
ALTER TABLE public.mfa_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users view own mfa" ON public.mfa_sessions FOR SELECT USING (auth.uid() = user_id);

-- ============ BACKUP CODES ============
CREATE TABLE public.backup_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.backup_codes ENABLE ROW LEVEL SECURITY;
-- No client access

-- ============ PROPERTIES ============
CREATE TABLE public.properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT,
  state TEXT,
  zip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER properties_updated_at BEFORE UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY "owners manage properties" ON public.properties FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "admins view properties" ON public.properties FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- ============ UNITS ============
CREATE TABLE public.units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  bedrooms INT,
  bathrooms NUMERIC(3,1),
  rent_amount NUMERIC(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER units_updated_at BEFORE UPDATE ON public.units FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY "owners manage units" ON public.units FOR ALL
  USING (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_id = auth.uid()));
CREATE POLICY "admins view units" ON public.units FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- ============ LEASES ============
CREATE TABLE public.leases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  landlord_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  rent_amount NUMERIC(10,2) NOT NULL,
  status public.lease_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.leases ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER leases_updated_at BEFORE UPDATE ON public.leases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY "tenants view own leases" ON public.leases FOR SELECT USING (auth.uid() = tenant_id);
CREATE POLICY "landlords manage leases" ON public.leases FOR ALL USING (auth.uid() = landlord_id) WITH CHECK (auth.uid() = landlord_id);
CREATE POLICY "admins view leases" ON public.leases FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- ============ PAYMENTS ============
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id UUID NOT NULL REFERENCES public.leases(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  due_date DATE NOT NULL,
  paid_at TIMESTAMPTZ,
  status public.payment_status NOT NULL DEFAULT 'pending',
  method TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER payments_updated_at BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY "tenants view own payments" ON public.payments FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.leases l WHERE l.id = lease_id AND l.tenant_id = auth.uid()));
CREATE POLICY "tenants insert own payments" ON public.payments FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.leases l WHERE l.id = lease_id AND l.tenant_id = auth.uid()));
CREATE POLICY "landlords manage payments" ON public.payments FOR ALL
  USING (EXISTS (SELECT 1 FROM public.leases l WHERE l.id = lease_id AND l.landlord_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.leases l WHERE l.id = lease_id AND l.landlord_id = auth.uid()));
CREATE POLICY "admins view payments" ON public.payments FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- ============ MAINTENANCE REQUESTS ============
CREATE TABLE public.maintenance_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id UUID NOT NULL REFERENCES public.leases(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status public.maintenance_status NOT NULL DEFAULT 'open',
  priority public.maintenance_priority NOT NULL DEFAULT 'medium',
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.maintenance_requests ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER maintenance_updated_at BEFORE UPDATE ON public.maintenance_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY "tenants view own maint" ON public.maintenance_requests FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.leases l WHERE l.id = lease_id AND l.tenant_id = auth.uid()));
CREATE POLICY "tenants create own maint" ON public.maintenance_requests FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.leases l WHERE l.id = lease_id AND l.tenant_id = auth.uid()) AND auth.uid() = created_by);
CREATE POLICY "landlords manage maint" ON public.maintenance_requests FOR ALL
  USING (EXISTS (SELECT 1 FROM public.leases l WHERE l.id = lease_id AND l.landlord_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.leases l WHERE l.id = lease_id AND l.landlord_id = auth.uid()));
CREATE POLICY "admins view maint" ON public.maintenance_requests FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- ============ DOCUMENTS ============
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id UUID REFERENCES public.leases(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners view docs" ON public.documents FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "owners insert docs" ON public.documents FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "owners delete docs" ON public.documents FOR DELETE USING (auth.uid() = owner_id);
CREATE POLICY "tenants view lease docs" ON public.documents FOR SELECT
  USING (lease_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.leases l WHERE l.id = lease_id AND l.tenant_id = auth.uid()));
CREATE POLICY "admins view docs" ON public.documents FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- ============ AUTO-CREATE PROFILE ON SIGNUP ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name, full_name, phone_e164)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    NULLIF(TRIM(CONCAT_WS(' ', NEW.raw_user_meta_data->>'first_name', NEW.raw_user_meta_data->>'last_name')), ''),
    NEW.raw_user_meta_data->>'phone_e164'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ SEED INVITE CODES ============
INSERT INTO public.invite_codes (code, role, created_by_name, expires_at, email, first_name, last_name, property, note, used_count, max_uses) VALUES
  ('LL-2026-XJ4K', 'landlord', 'System Administrator', '2026-05-20 23:59:59+00', NULL, NULL, NULL, NULL, 'New property manager onboarding', 0, 1),
  ('TN-2026-A7B3', 'tenant', 'Jordan Chen', '2026-05-06 23:59:59+00', 'new.tenant@example.com', 'Morgan', 'Patel', '215 Maple Ave • 3A', 'Unit 3A lease starting May 1', 0, 1),
  ('TN-2026-USED', 'tenant', 'Jordan Chen', '2025-07-24 23:59:59+00', 'alex@example.com', 'Alex', 'Rivera', '215 Maple Ave • 4B', 'Unit 4B', 1, 1);
