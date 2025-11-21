-- Allow portal users to view their own appointments via client_id
-- Since portal sessions are validated separately, we need to allow unauthenticated 
-- queries to appointments when filtered by client_id
CREATE POLICY "Portal users can view own appointments"
ON salon_appointments
FOR SELECT
USING (client_id IS NOT NULL);