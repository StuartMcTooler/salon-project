-- Fix RLS policies to be PERMISSIVE (default) instead of RESTRICTIVE
-- RESTRICTIVE policies only further restrict access, they don't grant it

-- Staff members: drop and recreate as permissive
DROP POLICY IF EXISTS "Anyone can view active staff" ON public.staff_members;

CREATE POLICY "Anyone can view active staff"
ON public.staff_members
FOR SELECT
TO public
USING (is_active = true);

-- Business accounts: drop and recreate as permissive
DROP POLICY IF EXISTS "Anyone can view active businesses" ON public.business_accounts;

CREATE POLICY "Anyone can view active businesses"
ON public.business_accounts
FOR SELECT
TO public
USING (is_active = true);