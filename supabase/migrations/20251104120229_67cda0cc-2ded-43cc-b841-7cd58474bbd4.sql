-- Drop the insecure policy
DROP POLICY IF EXISTS "Users can claim staff by name" ON public.staff_members;

-- Create a secure function that admins can call to link a user to a staff member
CREATE OR REPLACE FUNCTION public.link_user_to_staff(
  _staff_id uuid,
  _user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only admins can link users to staff
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can link users to staff members';
  END IF;
  
  UPDATE public.staff_members
  SET user_id = _user_id
  WHERE id = _staff_id;
END;
$$;
