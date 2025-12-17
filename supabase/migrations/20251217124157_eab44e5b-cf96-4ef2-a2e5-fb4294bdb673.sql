-- Fix: Make the public viewing policy PERMISSIVE (grants access)
-- RESTRICTIVE policies only narrow existing access, they don't grant it

DROP POLICY IF EXISTS "Anyone can view active staff" ON public.staff_members;

CREATE POLICY "Anyone can view active staff"
ON public.staff_members
AS PERMISSIVE
FOR SELECT
TO anon, authenticated
USING (is_active = true);

-- Also fix business_accounts
DROP POLICY IF EXISTS "Anyone can view active businesses" ON public.business_accounts;

CREATE POLICY "Anyone can view active businesses"
ON public.business_accounts
AS PERMISSIVE
FOR SELECT
TO anon, authenticated
USING (is_active = true);