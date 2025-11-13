-- Fix the SECURITY DEFINER view issue by dropping the view
-- We'll rely on RLS policies alone for security

DROP VIEW IF EXISTS public.public_staff_profiles;

-- The RLS policies created earlier are sufficient:
-- - Anonymous users are blocked from staff_members table
-- - Authenticated users can see active staff (needed for bookings)
-- - Staff can manage their own profiles
-- - Admins can manage all staff

-- Note: Frontend queries from anonymous users will simply return empty results
-- which is the secure behavior we want