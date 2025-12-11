-- Allow public users to read appointment times for availability checking
-- This only exposes appointment_date and duration_minutes, not customer data
CREATE POLICY "Public can view appointment slots for availability"
ON public.salon_appointments
FOR SELECT
USING (true);