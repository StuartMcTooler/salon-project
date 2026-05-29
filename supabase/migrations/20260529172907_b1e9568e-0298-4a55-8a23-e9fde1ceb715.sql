
-- 1) Drop overly permissive write policies on financial tables
DROP POLICY IF EXISTS "Service role can update credits" ON public.user_credits;
DROP POLICY IF EXISTS "Service role can insert earnings" ON public.creative_earnings;
DROP POLICY IF EXISTS "Service role can update earnings" ON public.creative_earnings;
DROP POLICY IF EXISTS "System can insert loyalty transactions" ON public.loyalty_transactions;
DROP POLICY IF EXISTS "System can insert fingerprints" ON public.payment_method_fingerprints;
DROP POLICY IF EXISTS "System can insert bonus entries" ON public.switching_bonus_ledger;

-- 2) Drop tautology policy on salon_appointments
DROP POLICY IF EXISTS "Clients can view own appointments" ON public.salon_appointments;

-- 3) Drop unrestricted public read on referral_codes
DROP POLICY IF EXISTS "Public can view referral codes" ON public.referral_codes;

-- 4) Restrict commission_tiers / creative_referral_terms to authenticated users
DROP POLICY IF EXISTS "Anyone can view active commission tiers" ON public.commission_tiers;
CREATE POLICY "Authenticated can view commission tiers"
ON public.commission_tiers FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "Anyone can view active referral terms" ON public.creative_referral_terms;
CREATE POLICY "Authenticated can view active referral terms"
ON public.creative_referral_terms FOR SELECT TO authenticated
USING (is_active = true);

-- 5) Column-level restrictions for anon on public-readable tables.
--    Authenticated users keep full SELECT (via existing table-level grant); anon only sees safe columns.

REVOKE SELECT ON public.business_accounts FROM anon;
GRANT SELECT (
  id, business_name, business_type, address, logo_url, is_active,
  smart_slots_enabled, referral_discount_type, referral_discount_value,
  notification_method, created_at, updated_at
) ON public.business_accounts TO anon;

REVOKE SELECT ON public.staff_members FROM anon;
GRANT SELECT (
  id, business_id, display_name, bio, profile_image_url, skill_level,
  is_active, tier, total_bookings, average_rating, total_reviews,
  is_accepting_referrals, simulate_fully_booked, city, area, specialties,
  is_test_user, minimum_booking_lead_hours, next_available_slot,
  next_available_slot_updated_at, allowed_terminal_types,
  require_booking_deposit, deposit_type, deposit_percentage, deposit_fixed_amount,
  referral_discount_type, referral_discount_value, created_at, updated_at,
  campaign_code, commission_tier_id, tier_upgraded_at
) ON public.staff_members TO anon;

REVOKE SELECT ON public.campaign_configs FROM anon, authenticated;
GRANT SELECT (
  id, campaign_code, switching_bonus_per_booking, switching_bonus_cap,
  double_sided_bonus, bonus_trigger_bookings, is_active, created_at, updated_at
) ON public.campaign_configs TO anon, authenticated;

-- 6) Storage policies: tighten client-content-raw bucket
DROP POLICY IF EXISTS "Creatives can read own raw files" ON storage.objects;
DROP POLICY IF EXISTS "Creatives can upload to raw bucket" ON storage.objects;

CREATE POLICY "Creatives can upload own raw files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'client-content-raw'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 7) Tighten is_solo_professional so it can't be used to enumerate other users
CREATE OR REPLACE FUNCTION public.is_solo_professional(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _user_id IS NULL OR auth.uid() IS NULL THEN
    RETURN false;
  END IF;
  IF _user_id <> auth.uid()
     AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1
    FROM staff_members sm
    JOIN business_accounts ba ON ba.id = sm.business_id
    WHERE sm.user_id = _user_id
      AND ba.business_type = 'solo_professional'
  );
END;
$$;
