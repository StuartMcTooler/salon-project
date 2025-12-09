-- Drop and recreate view with security_invoker to use caller's permissions
DROP VIEW IF EXISTS public.staff_members_public;

CREATE VIEW public.staff_members_public 
WITH (security_invoker = true)
AS
SELECT 
  id,
  display_name,
  profile_image_url,
  bio,
  city,
  area,
  specialties,
  skill_level,
  average_rating,
  total_bookings,
  tier,
  is_accepting_referrals,
  business_id,
  is_active,
  referral_discount_type,
  referral_discount_value,
  require_booking_deposit,
  deposit_type,
  deposit_percentage,
  deposit_fixed_amount,
  simulate_fully_booked,
  availability_test_days_from_now
FROM staff_members
WHERE is_active = true;

-- Grant public access to the view
GRANT SELECT ON public.staff_members_public TO anon, authenticated;