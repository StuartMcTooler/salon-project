-- Public availability view: only the columns needed for slot conflict checks.
-- Excludes all customer PII, pricing, payment, and notes columns.
CREATE OR REPLACE VIEW public.salon_appointments_availability
WITH (security_invoker = on) AS
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