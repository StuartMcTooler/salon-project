ALTER TABLE public.staff_members
  ADD COLUMN IF NOT EXISTS stripe_connect_test_account_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_connect_test_status TEXT NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS stripe_connect_test_onboarded_at TIMESTAMPTZ;