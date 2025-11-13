-- Fix: Staff Contact Information Publicly Exposed
-- Drop the existing overly permissive policy
DROP POLICY IF EXISTS "Staff members viewable by everyone" ON public.staff_members;

-- Anonymous users cannot directly query staff_members table
-- They should use the public_staff_profiles view instead
CREATE POLICY "Anonymous blocked from direct staff access" 
ON public.staff_members 
FOR SELECT 
TO anon
USING (false);

-- Allow authenticated users to see all active staff details (needed for bookings)
CREATE POLICY "Authenticated users can view active staff" 
ON public.staff_members 
FOR SELECT 
TO authenticated
USING (is_active = true);

-- Create a public view with only non-sensitive information
CREATE OR REPLACE VIEW public.public_staff_profiles AS
SELECT 
  id,
  display_name,
  full_name,
  bio,
  profile_image_url,
  skill_level,
  tier,
  average_rating,
  total_bookings,
  hourly_rate,
  is_active,
  business_id,
  created_at
FROM public.staff_members
WHERE is_active = true;

-- Grant select on the view to anon and authenticated roles
GRANT SELECT ON public.public_staff_profiles TO anon;
GRANT SELECT ON public.public_staff_profiles TO authenticated;