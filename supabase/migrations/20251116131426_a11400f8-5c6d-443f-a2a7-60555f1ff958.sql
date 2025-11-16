-- Make referral_codes phone-first
ALTER TABLE referral_codes 
  ALTER COLUMN referrer_phone SET NOT NULL,
  ALTER COLUMN referrer_email DROP NOT NULL;

-- Make user_credits phone-first
ALTER TABLE user_credits
  ALTER COLUMN customer_phone SET NOT NULL,
  ALTER COLUMN customer_email DROP NOT NULL;

-- Update RLS policies to use phone as primary identifier
DROP POLICY IF EXISTS "Solo professionals can create referral codes" ON referral_codes;
CREATE POLICY "Solo professionals can create referral codes"
  ON referral_codes
  FOR INSERT
  WITH CHECK (
    is_solo_professional(auth.uid())
  );

DROP POLICY IF EXISTS "Users can view own referral codes" ON referral_codes;
CREATE POLICY "Users can view own referral codes"
  ON referral_codes
  FOR SELECT
  USING (
    referrer_phone IN (
      SELECT phone FROM staff_members WHERE user_id = auth.uid()
    )
  );

-- Update user_credits policy to check phone
DROP POLICY IF EXISTS "Users can view own credits by email" ON user_credits;
CREATE POLICY "Users can view own credits by phone"
  ON user_credits
  FOR SELECT
  USING (
    customer_phone IN (
      SELECT phone FROM staff_members WHERE user_id = auth.uid()
    )
  );