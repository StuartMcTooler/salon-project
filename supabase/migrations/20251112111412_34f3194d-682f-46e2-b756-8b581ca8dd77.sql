-- Fix search_path for update_staff_rating function
CREATE OR REPLACE FUNCTION update_staff_rating(staff_uuid UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE staff_members
  SET 
    average_rating = (
      SELECT COALESCE(AVG(star_rating), 0)
      FROM feedback
      WHERE staff_id = staff_uuid
      AND star_rating IS NOT NULL
    ),
    total_bookings = (
      SELECT COUNT(*)
      FROM feedback
      WHERE staff_id = staff_uuid
    )
  WHERE id = staff_uuid;
END;
$$;