-- Priority #1: Next Slot Cache - Database-Level Availability Caching

-- Step 1: Add cache columns to staff_members
ALTER TABLE staff_members 
ADD COLUMN IF NOT EXISTS next_available_slot TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS next_available_slot_updated_at TIMESTAMPTZ DEFAULT NULL;

-- Step 2: Create the availability calculation function
CREATE OR REPLACE FUNCTION public.calculate_next_available_slot(p_staff_id UUID)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_next_slot TIMESTAMPTZ := NULL;
  v_check_date DATE;
  v_day_of_week INTEGER;
  v_hours RECORD;
  v_slot_time TIME;
  v_shortest_duration INTEGER;
  v_simulated_fully_booked BOOLEAN;
  v_business_id UUID;
BEGIN
  -- Check for simulated fully booked flag and get business_id
  SELECT simulate_fully_booked, business_id INTO v_simulated_fully_booked, v_business_id
  FROM staff_members WHERE id = p_staff_id;
  
  IF v_simulated_fully_booked THEN
    RETURN NULL;
  END IF;

  -- Get shortest service duration for this staff
  SELECT COALESCE(MIN(s.duration_minutes), 30) INTO v_shortest_duration
  FROM staff_service_pricing ssp
  JOIN services s ON s.id = ssp.service_id
  WHERE ssp.staff_id = p_staff_id AND ssp.is_available = true;

  -- Loop through next 30 days to find first available slot
  FOR i IN 0..29 LOOP
    v_check_date := CURRENT_DATE + i;
    v_day_of_week := EXTRACT(DOW FROM v_check_date)::INTEGER;
    
    -- Get business hours for this day (staff-specific first, then business)
    SELECT * INTO v_hours
    FROM business_hours
    WHERE (staff_id = p_staff_id OR (staff_id IS NULL AND business_id = v_business_id))
    AND day_of_week = v_day_of_week
    AND is_active = true
    ORDER BY staff_id NULLS LAST
    LIMIT 1;
    
    IF v_hours IS NULL THEN
      CONTINUE;
    END IF;
    
    -- Find first available slot in this day
    v_slot_time := v_hours.start_time;
    WHILE v_slot_time + (v_shortest_duration || ' minutes')::INTERVAL <= v_hours.end_time LOOP
      -- Skip break time
      IF v_hours.break_start_time IS NOT NULL AND v_hours.break_end_time IS NOT NULL THEN
        IF v_slot_time >= v_hours.break_start_time AND v_slot_time < v_hours.break_end_time THEN
          v_slot_time := v_hours.break_end_time;
          CONTINUE;
        END IF;
      END IF;
      
      -- Build the potential slot timestamp
      v_next_slot := v_check_date + v_slot_time;
      
      -- If today, check if slot is in the future
      IF v_check_date = CURRENT_DATE AND v_next_slot <= NOW() THEN
        v_slot_time := v_slot_time + '15 minutes'::INTERVAL;
        CONTINUE;
      END IF;
      
      -- Check for conflicts with existing appointments
      IF NOT EXISTS (
        SELECT 1 FROM salon_appointments sa
        WHERE sa.staff_id = p_staff_id
        AND sa.status IN ('pending', 'confirmed')
        AND sa.appointment_date IS NOT NULL
        AND (
          (v_next_slot >= sa.appointment_date 
           AND v_next_slot < sa.appointment_date + (sa.duration_minutes || ' minutes')::INTERVAL)
          OR
          (v_next_slot + (v_shortest_duration || ' minutes')::INTERVAL > sa.appointment_date 
           AND v_next_slot + (v_shortest_duration || ' minutes')::INTERVAL <= sa.appointment_date + (sa.duration_minutes || ' minutes')::INTERVAL)
          OR
          (v_next_slot <= sa.appointment_date 
           AND v_next_slot + (v_shortest_duration || ' minutes')::INTERVAL >= sa.appointment_date + (sa.duration_minutes || ' minutes')::INTERVAL)
        )
      ) THEN
        -- Found an available slot
        RETURN v_next_slot;
      END IF;
      
      v_slot_time := v_slot_time + '15 minutes'::INTERVAL;
    END LOOP;
  END LOOP;
  
  RETURN NULL; -- No availability found in next 30 days
END;
$$;

-- Step 3: Create the trigger function to refresh cache on appointment changes
CREATE OR REPLACE FUNCTION public.refresh_staff_availability_cache()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_staff_id UUID;
BEGIN
  -- Determine which staff member was affected
  IF TG_OP = 'DELETE' THEN
    v_staff_id := OLD.staff_id;
  ELSE
    v_staff_id := NEW.staff_id;
  END IF;
  
  -- Skip if no staff_id
  IF v_staff_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    ELSE
      RETURN NEW;
    END IF;
  END IF;
  
  -- Also update old staff if staff changed on UPDATE
  IF TG_OP = 'UPDATE' AND OLD.staff_id IS NOT NULL AND OLD.staff_id != NEW.staff_id THEN
    UPDATE staff_members
    SET 
      next_available_slot = calculate_next_available_slot(OLD.staff_id),
      next_available_slot_updated_at = NOW()
    WHERE id = OLD.staff_id;
  END IF;
  
  -- Update the affected staff member's cache
  UPDATE staff_members
  SET 
    next_available_slot = calculate_next_available_slot(v_staff_id),
    next_available_slot_updated_at = NOW()
  WHERE id = v_staff_id;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Step 4: Create the trigger on salon_appointments
DROP TRIGGER IF EXISTS trigger_refresh_availability_on_appointment ON salon_appointments;
CREATE TRIGGER trigger_refresh_availability_on_appointment
AFTER INSERT OR UPDATE OR DELETE ON salon_appointments
FOR EACH ROW
EXECUTE FUNCTION refresh_staff_availability_cache();

-- Step 5: Update the staff_members_public view to include availability columns
DROP VIEW IF EXISTS staff_members_public;
CREATE VIEW staff_members_public AS
SELECT 
  id,
  display_name,
  bio,
  profile_image_url,
  tier,
  average_rating,
  total_bookings,
  total_reviews,
  specialties,
  city,
  area,
  business_id,
  is_active,
  next_available_slot,
  next_available_slot_updated_at
FROM staff_members;

-- Grant access to the view
GRANT SELECT ON staff_members_public TO anon, authenticated;

-- Step 6: Backfill existing staff members with their availability
UPDATE staff_members
SET 
  next_available_slot = calculate_next_available_slot(id),
  next_available_slot_updated_at = NOW()
WHERE is_active = true;