-- Create enum for discount types
CREATE TYPE discount_type AS ENUM ('percentage', 'fixed_amount');

-- Add referral discount columns to business_accounts table
ALTER TABLE business_accounts
ADD COLUMN referral_discount_type discount_type DEFAULT 'percentage',
ADD COLUMN referral_discount_value numeric DEFAULT 15 CHECK (referral_discount_value >= 0);

-- Add referral discount columns to staff_members table
ALTER TABLE staff_members
ADD COLUMN referral_discount_type discount_type DEFAULT 'percentage',
ADD COLUMN referral_discount_value numeric DEFAULT 15 CHECK (referral_discount_value >= 0);

-- Add comment explaining the logic
COMMENT ON COLUMN business_accounts.referral_discount_type IS 'Controls referral discount for multi-staff salons';
COMMENT ON COLUMN staff_members.referral_discount_type IS 'Controls referral discount for solo professionals';