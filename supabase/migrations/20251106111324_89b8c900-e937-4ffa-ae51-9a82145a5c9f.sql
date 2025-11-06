-- Fix RLS on public.business_hours so admins (business owners) OR staff can manage rows independently
-- The previous policies were restrictive, effectively requiring BOTH conditions.
-- We drop and recreate them as PERMISSIVE so either condition is sufficient.

-- Drop existing policies
DROP POLICY IF EXISTS "Business owners can manage business hours" ON public.business_hours;
DROP POLICY IF EXISTS "Staff can manage own hours" ON public.business_hours;
DROP POLICY IF EXISTS "Everyone can view active business hours" ON public.business_hours;

-- Recreate policies as PERMISSIVE

-- 1) Public can view active hours
CREATE POLICY "Everyone can view active business hours"
ON public.business_hours
AS PERMISSIVE
FOR SELECT
USING (is_active = true);

-- 2) Business owners can manage business hours (rows tied to their business)
CREATE POLICY "Business owners can manage business hours"
ON public.business_hours
AS PERMISSIVE
FOR ALL
USING (
  business_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.business_accounts
    WHERE business_accounts.id = business_hours.business_id
      AND business_accounts.owner_user_id = auth.uid()
  )
)
WITH CHECK (
  business_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.business_accounts
    WHERE business_accounts.id = business_hours.business_id
      AND business_accounts.owner_user_id = auth.uid()
  )
);

-- 3) Staff can manage their own hours (rows tied to their staff record)
CREATE POLICY "Staff can manage own hours"
ON public.business_hours
AS PERMISSIVE
FOR ALL
USING (
  staff_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.staff_members
    WHERE staff_members.id = business_hours.staff_id
      AND staff_members.user_id = auth.uid()
  )
)
WITH CHECK (
  staff_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.staff_members
    WHERE staff_members.id = business_hours.staff_id
      AND staff_members.user_id = auth.uid()
  )
);