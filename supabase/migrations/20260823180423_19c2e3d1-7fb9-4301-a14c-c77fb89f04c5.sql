-- These policies all require auth.uid(); scoping them to the authenticated role
-- prevents anon evaluation from needing SELECT on sensitive staff_members columns.
DROP POLICY IF EXISTS "Owners can manage staff hours via staff relation" ON public.business_hours;
CREATE POLICY "Owners can manage staff hours via staff relation"
ON public.business_hours FOR ALL TO authenticated
USING ((staff_id IS NOT NULL) AND (EXISTS (
  SELECT 1 FROM staff_members s JOIN business_accounts b ON b.id = s.business_id
  WHERE s.id = business_hours.staff_id AND b.owner_user_id = auth.uid())))
WITH CHECK ((staff_id IS NOT NULL) AND (EXISTS (
  SELECT 1 FROM staff_members s JOIN business_accounts b ON b.id = s.business_id
  WHERE s.id = business_hours.staff_id AND b.owner_user_id = auth.uid())));

DROP POLICY IF EXISTS "Staff can manage own hours" ON public.business_hours;
CREATE POLICY "Staff can manage own hours"
ON public.business_hours FOR ALL TO authenticated
USING ((staff_id IS NOT NULL) AND (EXISTS (
  SELECT 1 FROM staff_members WHERE staff_members.id = business_hours.staff_id AND staff_members.user_id = auth.uid())))
WITH CHECK ((staff_id IS NOT NULL) AND (EXISTS (
  SELECT 1 FROM staff_members WHERE staff_members.id = business_hours.staff_id AND staff_members.user_id = auth.uid())));

DROP POLICY IF EXISTS "Front desk can view business appointments" ON public.salon_appointments;
CREATE POLICY "Front desk can view business appointments"
ON public.salon_appointments FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM staff_members s
  WHERE (s.id = salon_appointments.staff_id OR s.id = salon_appointments.original_requested_staff_id)
    AND is_front_desk_for_business(auth.uid(), s.business_id)));

DROP POLICY IF EXISTS "Staff select own appointments" ON public.salon_appointments;
CREATE POLICY "Staff select own appointments"
ON public.salon_appointments FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM staff_members s
  WHERE (s.id = salon_appointments.staff_id OR s.id = salon_appointments.original_requested_staff_id)
    AND s.user_id = auth.uid()));
