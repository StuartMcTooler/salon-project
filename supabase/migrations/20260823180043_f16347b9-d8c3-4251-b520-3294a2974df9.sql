-- 1) Restrict anonymous SELECT on staff_members to non-sensitive columns only
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.staff_members FROM anon;

GRANT SELECT (
  id, business_id, display_name, bio, profile_image_url, skill_level, is_active,
  tier, tier_upgraded_at, total_bookings, average_rating, total_reviews,
  city, area, specialties, next_available_slot, next_available_slot_updated_at,
  require_booking_deposit, deposit_type, deposit_percentage, deposit_fixed_amount,
  is_accepting_referrals, minimum_booking_lead_hours, simulate_fully_booked,
  availability_test_days_from_now, referral_discount_type, referral_discount_value,
  created_at, updated_at
) ON public.staff_members TO anon;

-- 2) Restrict anonymous SELECT on business_accounts to non-sensitive columns only
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.business_accounts FROM anon;

GRANT SELECT (
  id, business_name, business_type, address, logo_url, is_active,
  referral_discount_type, referral_discount_value, smart_slots_enabled,
  created_at, updated_at
) ON public.business_accounts TO anon;

-- 3) Revoke EXECUTE on privileged / internal SECURITY DEFINER functions
REVOKE ALL ON FUNCTION public.assign_front_desk_role(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.link_user_to_staff(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.manually_upgrade_to_pro(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_staff_rating(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.calculate_next_available_slot(uuid) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.check_appointment_overlap() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refresh_staff_availability_cache() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trigger_update_staff_rating() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_first_user_admin() FROM PUBLIC, anon, authenticated;

-- Token/booking helpers stay callable, but not via implicit PUBLIC grant
REVOKE ALL ON FUNCTION public.get_content_request_by_token(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.find_or_create_booking_client(text, text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_staff_busy_slots(uuid, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_content_request_by_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_or_create_booking_client(text, text, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_staff_busy_slots(uuid, timestamptz, timestamptz) TO anon, authenticated;

-- 4) Dedicated, unbypassable notification rate limiting
CREATE TABLE IF NOT EXISTS public.notification_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_key text NOT NULL,
  message_count integer NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS notification_rate_limits_bucket_key_idx
  ON public.notification_rate_limits (bucket_key);

GRANT ALL ON public.notification_rate_limits TO service_role;

ALTER TABLE public.notification_rate_limits ENABLE ROW LEVEL SECURITY;
