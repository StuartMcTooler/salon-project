-- Fix RLS policies to work for BOTH anon and authenticated users

-- Staff members: drop existing and create for both roles
DROP POLICY IF EXISTS "Public can view active staff" ON public.staff_members;

CREATE POLICY "Anyone can view active staff"
ON public.staff_members
FOR SELECT
USING (is_active = true);

-- Business accounts: drop existing and create for both roles
DROP POLICY IF EXISTS "Public can view active businesses" ON public.business_accounts;

CREATE POLICY "Anyone can view active businesses"
ON public.business_accounts
FOR SELECT
USING (is_active = true);