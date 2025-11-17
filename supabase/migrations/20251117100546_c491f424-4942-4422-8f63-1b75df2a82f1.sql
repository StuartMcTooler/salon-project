-- Migration Part 2: Functions and RLS Policies
-- Create helper function to check front_desk access
CREATE OR REPLACE FUNCTION public.is_front_desk_for_business(_user_id UUID, _business_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id
    AND ur.role = 'front_desk'
    AND (ur.business_id = _business_id OR ur.business_id IS NULL)
  )
$$;

-- Create function to assign front_desk role
CREATE OR REPLACE FUNCTION public.assign_front_desk_role(
  _user_id UUID,
  _business_id UUID,
  _admin_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM business_accounts
    WHERE id = _business_id AND owner_user_id = _admin_user_id
  ) THEN
    RAISE EXCEPTION 'Only business owner can assign front desk role';
  END IF;
  
  INSERT INTO user_roles (user_id, role, business_id)
  VALUES (_user_id, 'front_desk', _business_id)
  ON CONFLICT (user_id, role) DO UPDATE
  SET business_id = _business_id;
END;
$$;

-- RLS Policies for salon_appointments
CREATE POLICY "Front desk can view business appointments"
ON salon_appointments FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM staff_members s
    WHERE s.id = salon_appointments.staff_id
    AND public.is_front_desk_for_business(auth.uid(), s.business_id)
  )
);

CREATE POLICY "Front desk can create business appointments"
ON salon_appointments FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM staff_members s
    WHERE s.id = salon_appointments.staff_id
    AND public.is_front_desk_for_business(auth.uid(), s.business_id)
  )
);

CREATE POLICY "Front desk can update business appointments"
ON salon_appointments FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM staff_members s
    WHERE s.id = salon_appointments.staff_id
    AND public.is_front_desk_for_business(auth.uid(), s.business_id)
  )
);

CREATE POLICY "Front desk can delete business appointments"
ON salon_appointments FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM staff_members s
    WHERE s.id = salon_appointments.staff_id
    AND public.is_front_desk_for_business(auth.uid(), s.business_id)
  )
);

-- RLS Policies for clients
CREATE POLICY "Front desk can view business clients"
ON clients FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM staff_members s
    WHERE s.id = clients.primary_creative_id
    AND public.is_front_desk_for_business(auth.uid(), s.business_id)
  )
);

CREATE POLICY "Front desk can manage business clients"
ON clients FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM staff_members s
    WHERE s.id = clients.primary_creative_id
    AND public.is_front_desk_for_business(auth.uid(), s.business_id)
  )
);

-- Deny financial access to front_desk
CREATE POLICY "Front desk cannot view loyalty transactions"
ON loyalty_transactions FOR ALL
TO authenticated
USING (
  NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'front_desk'
  )
);

CREATE POLICY "Front desk cannot view referral transactions"
ON referral_transactions FOR ALL
TO authenticated
USING (
  NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'front_desk'
  )
);

CREATE POLICY "Front desk cannot view pricing"
ON staff_service_pricing FOR SELECT
TO authenticated
USING (
  NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'front_desk'
  )
);

CREATE POLICY "Front desk cannot view performance metrics"
ON creative_performance_metrics FOR SELECT
TO authenticated
USING (
  NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'front_desk'
  )
);

CREATE POLICY "Front desk cannot view revenue share"
ON c2c_revenue_share FOR SELECT
TO authenticated
USING (
  NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'front_desk'
  )
);