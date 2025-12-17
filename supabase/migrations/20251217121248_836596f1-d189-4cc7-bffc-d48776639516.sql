-- Drop the restrictive policy and recreate as permissive
DROP POLICY IF EXISTS "Public can view active staff" ON public.staff_members;

-- Create as PERMISSIVE policy (the default) so public users can see active staff
CREATE POLICY "Public can view active staff"
ON public.staff_members
FOR SELECT
TO public
USING (is_active = true);