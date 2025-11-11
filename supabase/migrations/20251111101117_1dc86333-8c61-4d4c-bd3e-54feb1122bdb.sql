-- Create function to check if user is a solo professional
CREATE OR REPLACE FUNCTION public.is_solo_professional(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM staff_members sm
    JOIN business_accounts ba ON ba.id = sm.business_id
    WHERE sm.user_id = _user_id
    AND ba.business_type = 'solo_professional'
  )
$$;

-- Drop old policies that allowed any staff to create referral codes
DROP POLICY IF EXISTS "Authenticated users can create own referral codes" ON referral_codes;
DROP POLICY IF EXISTS "Staff can create referral codes" ON referral_codes;

-- Create new policy restricting to solo professionals only
CREATE POLICY "Solo professionals can create referral codes"
ON referral_codes
FOR INSERT
TO authenticated
WITH CHECK (public.is_solo_professional(auth.uid()) AND referrer_email = (auth.jwt() ->> 'email'::text));