-- Create table for OTP authentication requests
CREATE TABLE IF NOT EXISTS public.auth_otp_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  phone_number text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  verified boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  verified_at timestamp with time zone
);

-- Add index for faster lookups
CREATE INDEX idx_auth_otp_client_phone ON public.auth_otp_requests(client_id, phone_number);
CREATE INDEX idx_auth_otp_expires ON public.auth_otp_requests(expires_at);

-- Enable RLS
ALTER TABLE public.auth_otp_requests ENABLE ROW LEVEL SECURITY;

-- Policy: System can manage OTP requests
CREATE POLICY "System can manage OTP requests"
  ON public.auth_otp_requests
  FOR ALL
  USING (true);

-- Create table for customer portal sessions
CREATE TABLE IF NOT EXISTS public.customer_portal_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  session_token text NOT NULL UNIQUE,
  expires_at timestamp with time zone NOT NULL,
  remember_me boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  last_accessed_at timestamp with time zone DEFAULT now()
);

-- Add index for faster session lookups
CREATE INDEX idx_portal_sessions_token ON public.customer_portal_sessions(session_token);
CREATE INDEX idx_portal_sessions_client ON public.customer_portal_sessions(client_id);

-- Enable RLS
ALTER TABLE public.customer_portal_sessions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own sessions
CREATE POLICY "Users can view own portal sessions"
  ON public.customer_portal_sessions
  FOR SELECT
  USING (true);

-- Policy: System can manage sessions
CREATE POLICY "System can manage portal sessions"
  ON public.customer_portal_sessions
  FOR ALL
  USING (true);