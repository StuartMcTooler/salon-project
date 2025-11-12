-- Add new columns to feedback table
ALTER TABLE feedback 
ADD COLUMN IF NOT EXISTS star_rating INTEGER CHECK (star_rating >= 1 AND star_rating <= 5),
ADD COLUMN IF NOT EXISTS staff_id UUID REFERENCES staff_members(id);

-- Create function to update staff average rating
CREATE OR REPLACE FUNCTION update_staff_rating(staff_uuid UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Create trigger to auto-update staff rating
CREATE OR REPLACE FUNCTION trigger_update_staff_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update rating for new/updated feedback
  IF NEW.staff_id IS NOT NULL THEN
    PERFORM update_staff_rating(NEW.staff_id);
  END IF;
  
  -- If staff_id changed, update old staff too
  IF TG_OP = 'UPDATE' AND OLD.staff_id IS NOT NULL AND OLD.staff_id != NEW.staff_id THEN
    PERFORM update_staff_rating(OLD.staff_id);
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_staff_rating_on_feedback ON feedback;
CREATE TRIGGER update_staff_rating_on_feedback
AFTER INSERT OR UPDATE ON feedback
FOR EACH ROW
EXECUTE FUNCTION trigger_update_staff_rating();

-- Update RLS policies to allow staff_id filtering
DROP POLICY IF EXISTS "Creatives can view their feedback" ON feedback;
CREATE POLICY "Creatives can view their feedback" ON feedback
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff_members
      WHERE staff_members.id = feedback.staff_id
      AND staff_members.user_id = auth.uid()
    )
  );