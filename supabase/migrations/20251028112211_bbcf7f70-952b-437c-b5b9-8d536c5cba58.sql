-- =====================================================
-- COMPLETE SALON PROJECT DATABASE MIGRATION (FIXED)
-- Includes: Roles, Profiles, Referrals, Feedback, Salon
-- =====================================================

-- 1. CREATE ENUM FOR ROLES
CREATE TYPE public.app_role AS ENUM ('admin', 'staff', 'user');

-- 2. CREATE USER_ROLES TABLE (BEFORE THE FUNCTION THAT REFERENCES IT)
CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 3. CREATE ROLE CHECKING FUNCTION (AFTER TABLE EXISTS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 4. TRIGGER TO MAKE FIRST USER ADMIN
CREATE OR REPLACE FUNCTION public.handle_first_user_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (SELECT count(*) FROM auth.users) = 1 THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin'::app_role);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_admin
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_first_user_admin();

-- 5. CREATE PROFILES TABLE
CREATE TABLE public.profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text NOT NULL UNIQUE,
    name text NOT NULL,
    phone text NOT NULL,
    default_delivery_address text,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

CREATE POLICY "System can insert profiles"
ON public.profiles FOR INSERT
WITH CHECK (true);

CREATE POLICY "Staff can view profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin'::app_role, 'staff'::app_role)
  )
);

-- 6. CREATE REFERRAL_CODES TABLE
CREATE TABLE public.referral_codes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text NOT NULL UNIQUE,
    referrer_email text NOT NULL,
    referrer_name text NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own referral codes"
ON public.referral_codes FOR SELECT
TO authenticated
USING (referrer_email = (auth.jwt() ->> 'email'));

CREATE POLICY "Authenticated users can create own referral codes"
ON public.referral_codes FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND referrer_email = (auth.jwt() ->> 'email'));

CREATE POLICY "Staff can create referral codes"
ON public.referral_codes FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin'::app_role, 'staff'::app_role)
  )
);

CREATE POLICY "Admins can view all referral codes"
ON public.referral_codes FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 7. CREATE USER_CREDITS TABLE
CREATE TABLE public.user_credits (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_email text NOT NULL,
    credit_type text NOT NULL,
    discount_percentage integer NOT NULL,
    voucher_code text,
    used boolean DEFAULT false NOT NULL,
    used_at timestamptz,
    expires_at timestamptz,
    order_id uuid,
    staff_id uuid,
    created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own credits by email"
ON public.user_credits FOR SELECT
TO authenticated
USING (customer_email = (auth.jwt() ->> 'email'));

CREATE POLICY "Staff can view created credits"
ON public.user_credits FOR SELECT
TO authenticated
USING (staff_id = auth.uid());

CREATE POLICY "Admins can view all credits"
ON public.user_credits FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can insert credits"
ON public.user_credits FOR INSERT
WITH CHECK (true);

CREATE POLICY "Service role can update credits"
ON public.user_credits FOR UPDATE
USING (true);

-- 8. CREATE FEEDBACK TABLE
CREATE TABLE public.feedback (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_name text NOT NULL,
    customer_email text,
    order_id uuid,
    feedback_text text NOT NULL,
    audio_transcript text,
    sentiment text,
    sentiment_score numeric,
    text_sentiment text,
    text_sentiment_score numeric,
    audio_sentiment text,
    audio_sentiment_score numeric,
    created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit feedback"
ON public.feedback FOR INSERT
WITH CHECK (true);

CREATE POLICY "Only admins can read feedback"
ON public.feedback FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 9. CREATE SERVICE_CATEGORIES TABLE
CREATE TABLE public.service_categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text,
    icon text,
    sort_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service categories viewable by everyone"
ON public.service_categories FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage service categories"
ON public.service_categories FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'::app_role
  )
);

-- 10. CREATE SERVICES TABLE
CREATE TABLE public.services (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id uuid REFERENCES public.service_categories(id) ON DELETE SET NULL,
    name text NOT NULL,
    description text,
    duration_minutes integer NOT NULL,
    base_price numeric NOT NULL,
    sort_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Services viewable by everyone"
ON public.services FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage services"
ON public.services FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'::app_role
  )
);

-- 11. CREATE STAFF_MEMBERS TABLE
CREATE TABLE public.staff_members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    full_name text NOT NULL,
    display_name text NOT NULL,
    email text,
    phone text,
    bio text,
    profile_image_url text,
    skill_level text,
    hourly_rate numeric,
    commission_rate numeric DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff members viewable by everyone"
ON public.staff_members FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage staff"
ON public.staff_members FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'::app_role
  )
);

CREATE POLICY "Staff can update own profile"
ON public.staff_members FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- 12. CREATE STAFF_SERVICE_PRICING TABLE
CREATE TABLE public.staff_service_pricing (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id uuid REFERENCES public.staff_members(id) ON DELETE CASCADE,
    service_id uuid REFERENCES public.services(id) ON DELETE CASCADE,
    custom_price numeric NOT NULL,
    is_available boolean DEFAULT true,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE (staff_id, service_id)
);

ALTER TABLE public.staff_service_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff pricing viewable by everyone"
ON public.staff_service_pricing FOR SELECT
USING (is_available = true);

CREATE POLICY "Admins can manage all pricing"
ON public.staff_service_pricing FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'::app_role
  )
);

CREATE POLICY "Staff can manage own pricing"
ON public.staff_service_pricing FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM staff_members
    WHERE staff_members.id = staff_service_pricing.staff_id
    AND staff_members.user_id = auth.uid()
  )
);

-- 13. CREATE SALON_APPOINTMENTS TABLE
CREATE TABLE public.salon_appointments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
    service_name text NOT NULL,
    staff_id uuid REFERENCES public.staff_members(id) ON DELETE SET NULL,
    customer_name text NOT NULL,
    customer_email text,
    customer_phone text,
    appointment_date timestamptz,
    duration_minutes integer NOT NULL,
    price numeric NOT NULL,
    status text DEFAULT 'pending',
    payment_status text DEFAULT 'pending',
    payment_method text,
    notes text,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.salon_appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view their own appointments"
ON public.salon_appointments FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM staff_members
    WHERE staff_members.id = salon_appointments.staff_id
    AND staff_members.user_id = auth.uid()
  )
);

CREATE POLICY "Staff can create appointments"
ON public.salon_appointments FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM staff_members
    WHERE staff_members.id = salon_appointments.staff_id
    AND staff_members.user_id = auth.uid()
  )
);

CREATE POLICY "Staff can update their own appointments"
ON public.salon_appointments FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM staff_members
    WHERE staff_members.id = salon_appointments.staff_id
    AND staff_members.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can manage all appointments"
ON public.salon_appointments FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'::app_role
  )
);

-- 14. CREATE UPDATED_AT TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 15. ADD UPDATED_AT TRIGGERS
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_services_updated_at
BEFORE UPDATE ON public.services
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_staff_members_updated_at
BEFORE UPDATE ON public.staff_members
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_staff_service_pricing_updated_at
BEFORE UPDATE ON public.staff_service_pricing
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_salon_appointments_updated_at
BEFORE UPDATE ON public.salon_appointments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();