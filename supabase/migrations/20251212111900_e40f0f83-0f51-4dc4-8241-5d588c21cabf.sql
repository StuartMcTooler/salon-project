-- Update the overlap trigger to allow walk-in appointments (created for current time)
CREATE OR REPLACE FUNCTION public.check_appointment_overlap()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  overlap_count INTEGER;
BEGIN
  -- Skip check for blocked time slots
  IF NEW.is_blocked = true THEN
    RETURN NEW;
  END IF;

  -- Skip overlap check for walk-in appointments (appointment time is within 5 minutes of now)
  -- Walk-ins are created for the current moment when a customer is physically present
  IF NEW.appointment_date >= NOW() - INTERVAL '5 minutes' 
     AND NEW.appointment_date <= NOW() + INTERVAL '5 minutes' THEN
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
$function$;