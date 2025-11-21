-- Remove the overly permissive policy
DROP POLICY IF EXISTS "Portal users can view own appointments" ON salon_appointments;