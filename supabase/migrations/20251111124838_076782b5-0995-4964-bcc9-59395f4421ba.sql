-- Add notification preferences to business_accounts
ALTER TABLE business_accounts 
ADD COLUMN IF NOT EXISTS notification_method TEXT DEFAULT 'hybrid' CHECK (notification_method IN ('whatsapp_first', 'sms_only', 'hybrid'));

COMMENT ON COLUMN business_accounts.notification_method IS 'Notification delivery preference: whatsapp_first (try WhatsApp only), sms_only (SMS only), hybrid (WhatsApp with SMS fallback)';

-- Add notification logs table for tracking delivery
CREATE TABLE IF NOT EXISTS notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES business_accounts(id) ON DELETE CASCADE,
  recipient_phone TEXT NOT NULL,
  message_type TEXT NOT NULL, -- 'booking_link', 'referral', 'feedback', 'appointment_change'
  delivery_method TEXT NOT NULL, -- 'whatsapp' or 'sms'
  status TEXT NOT NULL, -- 'success' or 'failed'
  twilio_message_id TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

-- Allow staff members to view their business notification logs
CREATE POLICY "Staff can view business notification logs"
ON notification_logs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM staff_members sm
    WHERE sm.business_id = notification_logs.business_id
    AND sm.user_id = auth.uid()
  )
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_notification_logs_business_id ON notification_logs(business_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_created_at ON notification_logs(created_at DESC);