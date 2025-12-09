-- Fix open appointment insertion: Restrict public INSERT to only essential booking fields
-- and require valid staff_id reference

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Anyone can insert appointments" ON public.salon_appointments;

-- Create a more restrictive policy for public booking
-- Allows unauthenticated users to create appointments but only with proper validation
CREATE POLICY "Public can book appointments with valid staff"
ON public.salon_appointments
FOR INSERT
TO anon, authenticated
WITH CHECK (
  -- Must reference a valid, active staff member
  staff_id IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM staff_members 
    WHERE id = salon_appointments.staff_id 
    AND is_active = true
  ) AND
  -- Must have customer info
  customer_name IS NOT NULL AND
  customer_name != '' AND
  -- Must have service info
  service_name IS NOT NULL AND
  service_name != '' AND
  -- Must have valid duration and price
  duration_minutes > 0 AND
  price >= 0 AND
  -- Cannot set blocked flag via public booking
  (is_blocked IS NULL OR is_blocked = false) AND
  -- Cannot set payment status to paid via public booking (prevents fraud)
  (payment_status IS NULL OR payment_status = 'pending')
);