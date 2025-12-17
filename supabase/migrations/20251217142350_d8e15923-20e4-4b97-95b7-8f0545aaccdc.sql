-- Drop the overly permissive policy that allows public access to OTP metadata
DROP POLICY IF EXISTS "System can manage OTP requests" ON public.auth_otp_requests;

-- Note: Edge functions (send-portal-otp, verify-portal-otp) use service role 
-- which bypasses RLS automatically, so no replacement policy is needed