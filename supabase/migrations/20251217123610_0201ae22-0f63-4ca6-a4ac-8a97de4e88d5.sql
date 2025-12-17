-- Fix RLS policies to explicitly grant to anon role (Supabase anonymous users)

-- Staff members: recreate policy for anon role
DROP POLICY IF EXISTS "Anyone can view active staff" ON public.staff_members;

CREATE POLICY "Anyone can view active staff"
ON public.staff_members
FOR SELECT
TO anon, authenticated
USING (is_active = true);

-- Business accounts: recreate policy for anon role
DROP POLICY IF EXISTS "Anyone can view active businesses" ON public.business_accounts;

CREATE POLICY "Anyone can view active businesses"
ON public.business_accounts
FOR SELECT
TO anon, authenticated
USING (is_active = true);

-- Staff service pricing: recreate policy for anon role
DROP POLICY IF EXISTS "Staff pricing viewable by everyone" ON public.staff_service_pricing;

CREATE POLICY "Staff pricing viewable by everyone"
ON public.staff_service_pricing
FOR SELECT
TO anon, authenticated
USING (is_available = true);