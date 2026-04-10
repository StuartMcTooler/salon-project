CREATE OR REPLACE FUNCTION check_appointment_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  overlap_count INTEGER;
  staff_break_start TIME;
  staff_break_end TIME;
  appointment_time TIME;
  appointment_end_time TIME;
BEGIN
  -- Skip for blocked time slots
  IF NEW.is_blocked = true THEN RETURN NEW; END IF;
  
  -- Skip overlap check for walk-ins (within 5 min of now) - they get priority
  IF NEW.appointment_date >= NOW() - INTERVAL '5 minutes' 
     AND NEW.appointment_date <= NOW() + INTERVAL '5 minutes' THEN
    RETURN NEW;
  END IF;

  -- Extract time in Dublin local time (handles GMT/IST automatically)
  -- Break times in business_hours are stored as local Dublin time,
  -- so we must compare in the same timezone
  appointment_time := (NEW.appointment_date AT TIME ZONE 'Europe/Dublin')::TIME;
  appointment_end_time := ((NEW.appointment_date + (NEW.duration_minutes || ' minutes')::INTERVAL) AT TIME ZONE 'Europe/Dublin')::TIME;

  -- Check if appointment conflicts with recurring break for this staff member
  SELECT break_start_time, break_end_time 
  INTO staff_break_start, staff_break_end
  FROM business_hours
  WHERE staff_id = NEW.staff_id
    AND day_of_week = EXTRACT(DOW FROM (NEW.appointment_date AT TIME ZONE 'Europe/Dublin'))::INTEGER
    AND is_active = true
    AND break_start_time IS NOT NULL
    AND break_end_time IS NOT NULL
  LIMIT 1;
  
  -- If break is defined, check for overlap
  IF staff_break_start IS NOT NULL AND staff_break_end IS NOT NULL THEN
    IF appointment_time < staff_break_end AND appointment_end_time > staff_break_start THEN
      RAISE EXCEPTION 'This time slot overlaps with a scheduled break. Please select a different time.';
    END IF;
  END IF;

  -- Existing overlap check with other appointments
  SELECT COUNT(*) INTO overlap_count
  FROM salon_appointments sa
  WHERE sa.staff_id = NEW.staff_id
    AND sa.id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND sa.status IN ('pending', 'confirmed')
    AND sa.is_blocked = false
    AND sa.appointment_date IS NOT NULL
    AND NEW.appointment_date IS NOT NULL
    AND (
      (NEW.appointment_date >= sa.appointment_date 
       AND NEW.appointment_date < sa.appointment_date + (sa.duration_minutes || ' minutes')::INTERVAL)
      OR
      (NEW.appointment_date + (NEW.duration_minutes || ' minutes')::INTERVAL > sa.appointment_date 
       AND NEW.appointment_date + (NEW.duration_minutes || ' minutes')::INTERVAL <= sa.appointment_date + (sa.duration_minutes || ' minutes')::INTERVAL)
      OR
      (NEW.appointment_date <= sa.appointment_date 
       AND NEW.appointment_date + (NEW.duration_minutes || ' minutes')::INTERVAL >= sa.appointment_date + (sa.duration_minutes || ' minutes')::INTERVAL)
    );

  IF overlap_count > 0 THEN
    RAISE EXCEPTION 'This time slot is no longer available. Please select a different time.';
  END IF;

  RETURN NEW;
END;
$$;