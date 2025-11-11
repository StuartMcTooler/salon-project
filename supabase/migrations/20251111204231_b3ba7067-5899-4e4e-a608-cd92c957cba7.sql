-- Add per-client deposit requirements to customer_loyalty_points table
ALTER TABLE customer_loyalty_points
ADD COLUMN require_booking_deposit boolean DEFAULT false,
ADD COLUMN deposit_notes text;

COMMENT ON COLUMN customer_loyalty_points.require_booking_deposit IS 'Flag flaky customers who require deposits';
COMMENT ON COLUMN customer_loyalty_points.deposit_notes IS 'Internal notes about why deposit is required';

-- Add deposit fields to staff_members table
ALTER TABLE staff_members
ADD COLUMN require_booking_deposit boolean DEFAULT false,
ADD COLUMN deposit_type text DEFAULT 'percentage',
ADD COLUMN deposit_percentage numeric DEFAULT 20,
ADD COLUMN deposit_fixed_amount numeric DEFAULT 10.00;

-- Add deposit tracking to salon_appointments table
ALTER TABLE salon_appointments
ADD COLUMN deposit_amount numeric,
ADD COLUMN deposit_paid boolean DEFAULT false,
ADD COLUMN remaining_balance numeric;