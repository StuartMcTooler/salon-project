ALTER VIEW public.staff_members_public SET (security_invoker = false);
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname='public' AND viewname='business_accounts_public') THEN
    EXECUTE 'ALTER VIEW public.business_accounts_public SET (security_invoker = false)';
  END IF;
END $$;