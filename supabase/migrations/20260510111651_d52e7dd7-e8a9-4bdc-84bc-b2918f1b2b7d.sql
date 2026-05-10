
ALTER TABLE public.business_accounts
  ADD COLUMN IF NOT EXISTS notification_method TEXT NOT NULL DEFAULT 'sms_only'
    CHECK (notification_method IN ('sms_only','hybrid','whatsapp_only'));

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS whatsapp_opted_in BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_opted_in_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_inbound_message_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_clients_phone_inbound
  ON public.clients (phone, last_inbound_message_at);
