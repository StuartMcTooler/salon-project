-- Add columns to track reminder status
ALTER TABLE public.salon_appointments 
ADD COLUMN IF NOT EXISTS reminder_72h_sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS reminder_24h_sent_at TIMESTAMP WITH TIME ZONE;

-- Add index for efficient reminder queries
CREATE INDEX IF NOT EXISTS idx_appointments_reminder_pending 
ON public.salon_appointments (appointment_date, status) 
WHERE status IN ('pending', 'confirmed') 
  AND (reminder_72h_sent_at IS NULL OR reminder_24h_sent_at IS NULL);