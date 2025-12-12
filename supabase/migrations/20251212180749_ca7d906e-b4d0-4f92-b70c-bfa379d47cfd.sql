-- Add RLS policy allowing staff members to read their own full record
CREATE POLICY "Staff can read own profile"
ON public.staff_members
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Also ensure authenticated users can read active staff (for booking flows)
CREATE POLICY "Authenticated users can view active staff"
ON public.staff_members
FOR SELECT
TO authenticated
USING (is_active = true);