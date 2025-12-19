-- Add minimum booking lead time setting to staff_members
-- This allows creatives to prevent bookings within X hours of the current time
ALTER TABLE staff_members 
ADD COLUMN minimum_booking_lead_hours INTEGER DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN staff_members.minimum_booking_lead_hours IS 'Minimum hours notice required for bookings. 0 = no restriction.';