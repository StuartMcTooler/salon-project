-- Phase 1: Add phone-based tracking and expiry to referral system

-- Add phone column to referral_codes
ALTER TABLE referral_codes 
ADD COLUMN IF NOT EXISTS referrer_phone TEXT;

CREATE INDEX IF NOT EXISTS idx_referral_codes_phone ON referral_codes(referrer_phone);

-- Add phone and expiry to user_credits  
ALTER TABLE user_credits
ADD COLUMN IF NOT EXISTS customer_phone TEXT,
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT (now() + interval '6 months');

CREATE INDEX IF NOT EXISTS idx_user_credits_phone ON user_credits(customer_phone, used, expires_at);

-- Migrate existing data: populate phone numbers from appointments
UPDATE referral_codes rc
SET referrer_phone = (
  SELECT customer_phone 
  FROM salon_appointments sa 
  WHERE sa.customer_email = rc.referrer_email 
  AND sa.customer_phone IS NOT NULL 
  LIMIT 1
)
WHERE referrer_phone IS NULL;

UPDATE user_credits uc
SET customer_phone = (
  SELECT customer_phone 
  FROM salon_appointments sa 
  WHERE sa.customer_email = uc.customer_email 
  AND sa.customer_phone IS NOT NULL 
  LIMIT 1
)
WHERE customer_phone IS NULL;