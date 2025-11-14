-- Migration 1: Switch customer_loyalty_points to phone-based primary identifier
ALTER TABLE customer_loyalty_points 
  ALTER COLUMN customer_phone SET NOT NULL,
  ALTER COLUMN customer_email DROP NOT NULL;

-- Drop old unique constraint and add new one based on phone
ALTER TABLE customer_loyalty_points
  DROP CONSTRAINT IF EXISTS customer_loyalty_points_customer_email_creative_id_key;

ALTER TABLE customer_loyalty_points
  ADD CONSTRAINT customer_loyalty_points_creative_id_customer_phone_key 
    UNIQUE (creative_id, customer_phone);

-- Add index for faster phone lookups
CREATE INDEX IF NOT EXISTS idx_customer_loyalty_phone 
  ON customer_loyalty_points(customer_phone, creative_id);

-- Migration 2: Add control hierarchy to loyalty_program_settings
ALTER TABLE loyalty_program_settings
  ADD COLUMN IF NOT EXISTS allow_staff_override boolean DEFAULT true;

COMMENT ON COLUMN loyalty_program_settings.allow_staff_override IS 
  'When true: chair rental model - staff can customize. When false: employee model - business settings apply to all';

-- Update loyalty_transactions to also use phone as primary
ALTER TABLE loyalty_transactions
  ALTER COLUMN customer_email DROP NOT NULL;

COMMENT ON COLUMN loyalty_transactions.customer_email IS 
  'Optional - phone number is the primary customer identifier';