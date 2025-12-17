-- Drop and recreate with correct role (anon, not public)
DROP POLICY IF EXISTS "Public can view active staff" ON public.staff_members;

CREATE POLICY "Public can view active staff"
ON public.staff_members
FOR SELECT
TO anon
USING (is_active = true);