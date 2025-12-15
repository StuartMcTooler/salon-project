-- Add total_reviews column to staff_members
ALTER TABLE public.staff_members ADD COLUMN total_reviews INTEGER DEFAULT 0;

-- Update staff_members_public view to include total_reviews
DROP VIEW IF EXISTS public.staff_members_public;
CREATE VIEW public.staff_members_public WITH (security_invoker = true) AS
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
  is_active
FROM public.staff_members;

-- Fix update_staff_rating function - DO NOT touch total_bookings anymore
CREATE OR REPLACE FUNCTION public.update_staff_rating(staff_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE staff_members
  SET 
    average_rating = (
      SELECT COALESCE(AVG(star_rating), 0)
      FROM feedback
      WHERE staff_id = staff_uuid
      AND star_rating IS NOT NULL
    ),
    total_reviews = (
      SELECT COUNT(*)
      FROM feedback
      WHERE staff_id = staff_uuid
      AND star_rating IS NOT NULL
    )
  WHERE id = staff_uuid;
END;
$function$;

-- Backfill existing total_reviews data
UPDATE staff_members sm
SET total_reviews = (
  SELECT COUNT(*)
  FROM feedback f
  WHERE f.staff_id = sm.id
  AND f.star_rating IS NOT NULL
);