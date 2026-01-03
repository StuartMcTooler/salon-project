-- Fix Security Definer View issue by using security_invoker = true
DROP VIEW IF EXISTS staff_members_public;
CREATE VIEW staff_members_public 
WITH (security_invoker = true)
AS
SELECT 
  id,
  display_name,
  bio,
  profile_image_url,
  tier,
  average_rating,
  total_bookings,
  total_reviews,
  specialties,
  city,
  area,
  business_id,
  is_active,
  next_available_slot,
  next_available_slot_updated_at
FROM staff_members;

-- Grant access to the view
GRANT SELECT ON staff_members_public TO anon, authenticated;