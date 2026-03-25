
ALTER TABLE public.profiles
  ADD COLUMN is_internal_tester boolean NOT NULL DEFAULT false,
  ADD COLUMN stripe_mode_override text NOT NULL DEFAULT 'default';
