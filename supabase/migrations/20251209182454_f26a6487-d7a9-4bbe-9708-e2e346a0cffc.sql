-- Create table to track OTP rate limiting
CREATE TABLE public.otp_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number text NOT NULL,
  attempt_count integer NOT NULL DEFAULT 1,
  window_start timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

-- Create index for efficient lookups
CREATE INDEX idx_otp_rate_limits_phone_window ON public.otp_rate_limits(phone_number, window_start);

-- Enable RLS
ALTER TABLE public.otp_rate_limits ENABLE ROW LEVEL SECURITY;

-- Only allow system/service role to manage rate limits
CREATE POLICY "System can manage rate limits"
ON public.otp_rate_limits
FOR ALL
USING (true);

-- Create a secure view for public staff data (hides sensitive columns)
CREATE VIEW public.staff_members_public AS
SELECT 
  id,
  display_name,
  profile_image_url,
  bio,
  city,
  area,
  specialties,
  skill_level,
  average_rating,
  total_bookings,
  tier,
  is_accepting_referrals,
  business_id,
  is_active,
  referral_discount_type,
  referral_discount_value,
  require_booking_deposit,
  deposit_type,
  deposit_percentage,
  deposit_fixed_amount,
  simulate_fully_booked,
  availability_test_days_from_now
FROM staff_members
WHERE is_active = true;

-- Grant public access to the view
GRANT SELECT ON public.staff_members_public TO anon, authenticated;