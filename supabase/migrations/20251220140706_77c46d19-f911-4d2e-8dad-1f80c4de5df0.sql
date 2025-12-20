-- Add Stripe Connect columns to staff_members
ALTER TABLE staff_members 
  ADD COLUMN IF NOT EXISTS stripe_connect_account_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_connect_status TEXT DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS stripe_connect_onboarded_at TIMESTAMPTZ;

-- Add index for webhook lookups by connect account ID
CREATE INDEX IF NOT EXISTS idx_staff_stripe_connect_account_id 
  ON staff_members(stripe_connect_account_id) 
  WHERE stripe_connect_account_id IS NOT NULL;

-- Create analytics table for tracking earnings (read-only, Stripe is source of truth)
CREATE TABLE IF NOT EXISTS creative_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creative_id UUID REFERENCES staff_members(id) NOT NULL,
  appointment_id UUID REFERENCES salon_appointments(id),
  gross_amount DECIMAL(10,2) NOT NULL,
  platform_fee DECIMAL(10,2) NOT NULL,
  referral_commission DECIMAL(10,2) DEFAULT 0,
  net_earnings DECIMAL(10,2) NOT NULL,
  stripe_payment_intent_id TEXT,
  stripe_transfer_id TEXT,
  transfer_group TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on creative_earnings
ALTER TABLE creative_earnings ENABLE ROW LEVEL SECURITY;

-- Creatives can only view their own earnings
CREATE POLICY "Creatives can view own earnings" ON creative_earnings
  FOR SELECT USING (
    creative_id IN (
      SELECT id FROM staff_members WHERE user_id = auth.uid()
    )
  );

-- Admins can view all earnings
CREATE POLICY "Admins can view all earnings" ON creative_earnings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Only system can insert earnings (via service role from edge functions)
CREATE POLICY "Service role can insert earnings" ON creative_earnings
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service role can update earnings" ON creative_earnings
  FOR UPDATE USING (true);