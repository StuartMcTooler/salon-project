-- Fix Profiles Table INSERT Policy Security Issue
-- Replace overly permissive policy with secure authenticated-only policy

DROP POLICY IF EXISTS "System can insert profiles" ON public.profiles;

CREATE POLICY "Users can create own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);