-- Normalize salon_appointments policies to permissive to avoid conflicts

-- Admin ALL policy -> PERMISSIVE
DROP POLICY IF EXISTS "Admins can manage all appointments" ON salon_appointments;
CREATE POLICY "Admins can manage all appointments"
  ON salon_appointments
  AS PERMISSIVE
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Staff UPDATE policy -> PERMISSIVE
DROP POLICY IF EXISTS "Staff can update their own appointments" ON salon_appointments;
CREATE POLICY "Staff can update their own appointments"
  ON salon_appointments
  AS PERMISSIVE
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM staff_members s
      WHERE s.id = salon_appointments.staff_id
      AND s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff_members s
      WHERE s.id = salon_appointments.staff_id
      AND s.user_id = auth.uid()
    )
  );

-- Staff SELECT policy -> PERMISSIVE
DROP POLICY IF EXISTS "Staff can view their own appointments" ON salon_appointments;
CREATE POLICY "Staff can view their own appointments"
  ON salon_appointments
  AS PERMISSIVE
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff_members s
      WHERE s.id = salon_appointments.staff_id
      AND s.user_id = auth.uid()
    )
  );