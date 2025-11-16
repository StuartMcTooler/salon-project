-- Drop the policy that blocks anonymous users
DROP POLICY IF EXISTS "Anonymous blocked from direct staff access" ON staff_members;

-- Update the policy for authenticated users to also allow anonymous users to view active staff
DROP POLICY IF EXISTS "Authenticated users can view active staff" ON staff_members;

-- Create a new policy that allows everyone (including anonymous) to view active staff
CREATE POLICY "Public can view active staff"
  ON staff_members
  FOR SELECT
  USING (is_active = true);