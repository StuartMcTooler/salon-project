
-- 1. salon_appointments: drop the public-everything-readable SELECT policy.
-- Public booking pages use the get-staff-availability edge function (service role) instead.
DROP POLICY IF EXISTS "Public can view appointment slots for availability" ON public.salon_appointments;

-- 2. customer_portal_sessions: tokens are auth credentials. Service role only.
DROP POLICY IF EXISTS "System can manage portal sessions" ON public.customer_portal_sessions;
DROP POLICY IF EXISTS "Users can view own portal sessions" ON public.customer_portal_sessions;

-- 3. otp_rate_limits: phone numbers + brute-force counters. Service role only.
DROP POLICY IF EXISTS "System can manage rate limits" ON public.otp_rate_limits;

-- 4. staff_invites: invite tokens. Service role only (handled by edge functions).
DROP POLICY IF EXISTS "System can manage invites" ON public.staff_invites;

-- 5. customer_loyalty_points: PII + balances. Drop public ALL; service role mutates.
DROP POLICY IF EXISTS "System can manage loyalty points" ON public.customer_loyalty_points;

-- 6. creative_performance_metrics: drop public ALL; system writes via service role.
DROP POLICY IF EXISTS "System can manage metrics" ON public.creative_performance_metrics;

-- 7. portfolio_approval_requests: client PII + tokens. Service role only for system access.
DROP POLICY IF EXISTS "System can manage approval requests" ON public.portfolio_approval_requests;

-- 8. client_content: drop public-ALL system policy; system writes via service role.
DROP POLICY IF EXISTS "System can manage content" ON public.client_content;
-- Tighten public viewing to only 'public' scope (truly public portfolio); 'shared' requires the creative or client.
DROP POLICY IF EXISTS "Clients can view shared and public content" ON public.client_content;
CREATE POLICY "Public portfolio content is viewable"
ON public.client_content FOR SELECT
USING (visibility_scope = 'public');

-- 9. content_requests: drop the always-true token policy + system update policy.
-- Token-based public access should go through a security definer RPC (next).
DROP POLICY IF EXISTS "Public can view by valid token" ON public.content_requests;
DROP POLICY IF EXISTS "System can update requests" ON public.content_requests;

CREATE OR REPLACE FUNCTION public.get_content_request_by_token(_token text)
RETURNS SETOF public.content_requests
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.content_requests
  WHERE token = _token
    AND token_expires_at > now()
  LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.get_content_request_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_content_request_by_token(text) TO anon, authenticated;

-- 10. referral_transactions: drop anonymous insert.
DROP POLICY IF EXISTS "System can insert transactions" ON public.referral_transactions;

-- 11. user_credits: drop public insert policies; only service role / authenticated staff create.
DROP POLICY IF EXISTS "Public can create credits" ON public.user_credits;
DROP POLICY IF EXISTS "Service role can insert credits" ON public.user_credits;

-- 12. client_ownership: drop wide-open public insert; tag is created via authenticated creative.
DROP POLICY IF EXISTS "Public can tag clients" ON public.client_ownership;

-- 13. is_front_desk_for_business: remove NULL business_id privilege escalation.
CREATE OR REPLACE FUNCTION public.is_front_desk_for_business(_user_id uuid, _business_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role = 'front_desk'
      AND ur.business_id IS NOT NULL
      AND ur.business_id = _business_id
  )
$$;

-- 14. Storage: profile-images update/delete must verify ownership (path prefix = user id).
DROP POLICY IF EXISTS "Users can delete their own profile images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own profile images" ON storage.objects;

CREATE POLICY "Users can update their own profile images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'profile-images' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'profile-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete their own profile images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'profile-images' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 15. Storage: make client-content-raw private; restrict reads to owning creative or client portal session.
UPDATE storage.buckets SET public = false WHERE id = 'client-content-raw';
DROP POLICY IF EXISTS "Public read access for client-content-raw" ON storage.objects;

CREATE POLICY "Creatives can read own client content raw"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'client-content-raw'
  AND EXISTS (
    SELECT 1 FROM public.client_content cc
    JOIN public.staff_members sm ON sm.id = cc.creative_id
    WHERE sm.user_id = auth.uid()
      AND cc.raw_file_path = storage.objects.name
  )
);

-- Service role and edge functions continue to access via signed URLs / service key.
