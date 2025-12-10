-- Create function to check for appointment overlaps
CREATE OR REPLACE FUNCTION public.check_appointment_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  overlap_count INTEGER;
BEGIN
  -- Skip check for blocked time slots
  IF NEW.is_blocked = true THEN
    RETURN NEW;
  END IF;

  -- Check for overlapping appointments
  SELECT COUNT(*) INTO overlap_count
  FROM salon_appointments
  WHERE staff_id = NEW.staff_id
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND status IN ('pending', 'confirmed')
    AND is_blocked = false
    AND (
      -- New appointment starts during existing appointment
      (NEW.appointment_date >= appointment_date 
       AND NEW.appointment_date < appointment_date + (duration_minutes || ' minutes')::interval)
      OR
      -- New appointment ends during existing appointment
      (NEW.appointment_date + (NEW.duration_minutes || ' minutes')::interval > appointment_date 
       AND NEW.appointment_date + (NEW.duration_minutes || ' minutes')::interval <= appointment_date + (duration_minutes || ' minutes')::interval)
      OR
      -- New appointment completely contains existing appointment
      (NEW.appointment_date <= appointment_date 
       AND NEW.appointment_date + (NEW.duration_minutes || ' minutes')::interval >= appointment_date + (duration_minutes || ' minutes')::interval)
    );

  IF overlap_count > 0 THEN
    RAISE EXCEPTION 'This time slot is no longer available. Please select a different time.';
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS check_appointment_overlap_trigger ON public.salon_appointments;
CREATE TRIGGER check_appointment_overlap_trigger
  BEFORE INSERT OR UPDATE ON public.salon_appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.check_appointment_overlap();