-- Phase 1: Add break time columns to business_hours table
ALTER TABLE business_hours 
ADD COLUMN break_start_time TIME,
ADD COLUMN break_end_time TIME;

-- Add comments for clarity
COMMENT ON COLUMN business_hours.break_start_time IS 'Optional recurring break start time (e.g., lunch break)';
COMMENT ON COLUMN business_hours.break_end_time IS 'Optional recurring break end time';

-- Phase 2 (Part 3): Update the check_appointment_overlap trigger to prevent bookings during break periods
CREATE OR REPLACE FUNCTION check_appointment_overlap()
RETURNS trigger AS $$
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

  -- Extract time from appointment
  appointment_time := NEW.appointment_date::TIME;
  appointment_end_time := (NEW.appointment_date + (NEW.duration_minutes || ' minutes')::INTERVAL)::TIME;

  -- Check if appointment conflicts with recurring break for this staff member
  SELECT break_start_time, break_end_time 
  INTO staff_break_start, staff_break_end
  FROM business_hours
  WHERE staff_id = NEW.staff_id
    AND day_of_week = EXTRACT(DOW FROM NEW.appointment_date)::INTEGER
    AND is_active = true
    AND break_start_time IS NOT NULL
    AND break_end_time IS NOT NULL
  LIMIT 1;
  
  -- If break is defined, check for overlap
  IF staff_break_start IS NOT NULL AND staff_break_end IS NOT NULL THEN
    -- Check if appointment overlaps with break period
    -- Overlap occurs if: appointment_start < break_end AND appointment_end > break_start
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
      -- New appointment starts during existing
      (NEW.appointment_date >= sa.appointment_date 
       AND NEW.appointment_date < sa.appointment_date + (sa.duration_minutes || ' minutes')::INTERVAL)
      OR
      -- New appointment ends during existing
      (NEW.appointment_date + (NEW.duration_minutes || ' minutes')::INTERVAL > sa.appointment_date 
       AND NEW.appointment_date + (NEW.duration_minutes || ' minutes')::INTERVAL <= sa.appointment_date + (sa.duration_minutes || ' minutes')::INTERVAL)
      OR
      -- New appointment completely contains existing
      (NEW.appointment_date <= sa.appointment_date 
       AND NEW.appointment_date + (NEW.duration_minutes || ' minutes')::INTERVAL >= sa.appointment_date + (sa.duration_minutes || ' minutes')::INTERVAL)
    );

  IF overlap_count > 0 THEN
    RAISE EXCEPTION 'This time slot is no longer available. Please select a different time.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;