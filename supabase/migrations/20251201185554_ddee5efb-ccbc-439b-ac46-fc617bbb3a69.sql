-- Add is_blocked column to salon_appointments for time blocking feature
-- This is a transaction-safe boolean flag approach that avoids enum modification issues
ALTER TABLE salon_appointments ADD COLUMN is_blocked BOOLEAN DEFAULT false;

-- Add index for performance when filtering out blocks
CREATE INDEX idx_salon_appointments_is_blocked ON salon_appointments(is_blocked) WHERE is_blocked = true;

-- Add comment for documentation
COMMENT ON COLUMN salon_appointments.is_blocked IS 'TRUE = Time block (non-revenue), FALSE/NULL = Real booking. Used instead of booking_type enum to avoid transaction limitations.';