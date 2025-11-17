-- Add referral acceptance flag to staff_members table
ALTER TABLE staff_members 
ADD COLUMN IF NOT EXISTS is_accepting_referrals BOOLEAN DEFAULT TRUE;