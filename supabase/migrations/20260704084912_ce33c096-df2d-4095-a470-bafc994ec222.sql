
-- 1. Drop unused availability view (SECURITY DEFINER by default)
DROP VIEW IF EXISTS public.salon_appointments_availability;

-- 2. Recreate staff_members_public as SECURITY INVOKER
DROP VIEW IF EXISTS public.staff_members_public;
CREATE VIEW public.staff_members_public
WITH (security_invoker = true) AS
SELECT
  id,
  display_name,
  bio,
  profile_image_url,
  tier,
  average_rating,
  total_bookings,
  total_reviews,
  specialties,
  city,
  area,
  business_id,
  is_active,
  next_available_slot,
  next_available_slot_updated_at
FROM public.staff_members;

GRANT SELECT ON public.staff_members_public TO anon, authenticated;

-- 3. Lock down realtime broadcast subscriptions
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can receive broadcasts" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated can send broadcasts" ON realtime.messages;

CREATE POLICY "Authenticated can receive broadcasts"
ON realtime.messages
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated can send broadcasts"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (true);
