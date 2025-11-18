-- Phase 1: Add overflow tracking columns to salon_appointments
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_type_enum') THEN
    CREATE TYPE booking_type_enum AS ENUM ('direct', 'cover', 'referral_network');
  END IF;
END $$;

ALTER TABLE salon_appointments 
ADD COLUMN IF NOT EXISTS booking_type booking_type_enum DEFAULT 'direct',
ADD COLUMN IF NOT EXISTS original_requested_staff_id UUID REFERENCES staff_members(id);

-- Add test mode column to staff_members
ALTER TABLE staff_members 
ADD COLUMN IF NOT EXISTS simulate_fully_booked BOOLEAN DEFAULT false;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_appointments_booking_type ON salon_appointments(booking_type);
CREATE INDEX IF NOT EXISTS idx_appointments_original_staff ON salon_appointments(original_requested_staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_simulate_booked ON staff_members(simulate_fully_booked) WHERE simulate_fully_booked = true;

-- Update RLS policies to ensure cover bookings are handled correctly
-- Staff can view appointments where they are either the actual staff or the originally requested staff
DROP POLICY IF EXISTS "Staff select own appointments" ON salon_appointments;
CREATE POLICY "Staff select own appointments" ON salon_appointments
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM staff_members s
    WHERE (s.id = salon_appointments.staff_id OR s.id = salon_appointments.original_requested_staff_id)
    AND s.user_id = auth.uid()
  )
);

-- Front desk can view appointments for both actual and originally requested staff in their business
DROP POLICY IF EXISTS "Front desk can view business appointments" ON salon_appointments;
CREATE POLICY "Front desk can view business appointments" ON salon_appointments
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM staff_members s
    WHERE (s.id = salon_appointments.staff_id OR s.id = salon_appointments.original_requested_staff_id)
    AND is_front_desk_for_business(auth.uid(), s.business_id)
  )
);

COMMENT ON COLUMN salon_appointments.booking_type IS 'Type of booking: direct (normal), cover (overflow from trusted network), referral_network (referred by another creative)';
COMMENT ON COLUMN salon_appointments.original_requested_staff_id IS 'For cover bookings: the staff member the client originally wanted to book with';
COMMENT ON COLUMN staff_members.simulate_fully_booked IS 'Test mode: when true, staff appears fully booked to test overflow logic';