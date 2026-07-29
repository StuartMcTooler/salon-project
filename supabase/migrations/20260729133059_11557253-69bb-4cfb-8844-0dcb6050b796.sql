CREATE OR REPLACE FUNCTION public.get_staff_busy_slots(
  _staff_id uuid,
  _start timestamptz,
  _end timestamptz
)
RETURNS TABLE (appointment_date timestamptz, duration_minutes integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sa.appointment_date, sa.duration_minutes
  FROM public.salon_appointments sa
  WHERE sa.staff_id = _staff_id
    AND sa.status IN ('pending', 'confirmed')
    AND sa.is_blocked = false
    AND sa.appointment_date >= _start
    AND sa.appointment_date <= _end;
$$;

GRANT EXECUTE ON FUNCTION public.get_staff_busy_slots(uuid, timestamptz, timestamptz) TO anon, authenticated;