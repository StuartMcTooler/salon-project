-- Fix salon_appointments RLS policies to be PERMISSIVE
-- This allows inserts from either public users OR staff members

-- Drop existing insert policies
DROP POLICY IF EXISTS "Public can create appointments" ON salon_appointments;
DROP POLICY IF EXISTS "Staff can create appointments" ON salon_appointments;

-- Recreate as PERMISSIVE policies (any one passing allows the action)
CREATE POLICY "Public can create appointments"
  ON salon_appointments
  AS PERMISSIVE
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Staff can create appointments"
  ON salon_appointments
  AS PERMISSIVE
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff_members
      WHERE staff_members.id = salon_appointments.staff_id
      AND staff_members.user_id = auth.uid()
    )
  );