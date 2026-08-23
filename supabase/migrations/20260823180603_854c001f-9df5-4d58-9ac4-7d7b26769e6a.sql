-- RLS policies evaluated for anonymous readers of public tables reference these
-- opaque identifier columns; they contain no personal data.
GRANT SELECT (user_id) ON public.staff_members TO anon;
GRANT SELECT (owner_user_id) ON public.business_accounts TO anon;

-- Policies matching on staff phone numbers must never be evaluated for anon.
DROP POLICY IF EXISTS "Users can view own referral codes" ON public.referral_codes;
CREATE POLICY "Users can view own referral codes" ON public.referral_codes FOR SELECT TO authenticated
USING (referrer_phone IN (SELECT staff_members.phone FROM staff_members WHERE staff_members.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can view own credits by phone" ON public.user_credits;
CREATE POLICY "Users can view own credits by phone" ON public.user_credits FOR SELECT TO authenticated
USING (customer_phone IN (SELECT staff_members.phone FROM staff_members WHERE staff_members.user_id = auth.uid()));
