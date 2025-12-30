-- Add audit columns to referral_transactions for financial reporting/grandfathering
ALTER TABLE referral_transactions 
ADD COLUMN IF NOT EXISTS commission_tier_id UUID REFERENCES commission_tiers(id),
ADD COLUMN IF NOT EXISTS commission_fixed_amount NUMERIC(10,2);

-- Create in-app bonus notifications table (The "Dopamine" System)
CREATE TABLE IF NOT EXISTS bonus_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creative_id UUID REFERENCES staff_members(id) NOT NULL,
  notification_type TEXT NOT NULL,
  bonus_amount NUMERIC(10,2),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS policies for bonus_notifications
ALTER TABLE bonus_notifications ENABLE ROW LEVEL SECURITY;

-- Drop policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can view their own notifications" ON bonus_notifications;
DROP POLICY IF EXISTS "Users can mark their notifications as read" ON bonus_notifications;

CREATE POLICY "Users can view their own notifications"
ON bonus_notifications FOR SELECT
USING (creative_id IN (SELECT id FROM staff_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can mark their notifications as read"
ON bonus_notifications FOR UPDATE
USING (creative_id IN (SELECT id FROM staff_members WHERE user_id = auth.uid()));