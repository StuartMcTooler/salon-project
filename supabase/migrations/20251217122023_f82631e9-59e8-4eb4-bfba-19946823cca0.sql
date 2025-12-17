-- Fix business_accounts public policy to use anon role
DROP POLICY IF EXISTS "Public can view active businesses" ON public.business_accounts;

CREATE POLICY "Public can view active businesses"
ON public.business_accounts
FOR SELECT
TO anon
USING (is_active = true);