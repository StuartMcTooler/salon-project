-- Re-create as a SECURITY DEFINER view by toggling security_invoker off,
-- so anon visitors can read just the availability columns without inheriting
-- the restrictive RLS on salon_appointments.
DROP VIEW IF EXISTS public.salon_appointments_availability;

CREATE VIEW public.salon_appointments_availability
WITH (security_invoker = off) AS
SELECT
  id,
  staff_id,
  appointment_date,
  duration_minutes,
  status,
  is_blocked
FROM public.salon_appointments
WHERE status IN ('pending', 'confirmed')
  AND appointment_date IS NOT NULL;

GRANT SELECT ON public.salon_appointments_availability TO anon, authenticated;