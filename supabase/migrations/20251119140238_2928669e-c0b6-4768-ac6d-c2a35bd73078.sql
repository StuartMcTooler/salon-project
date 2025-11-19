-- Allow admins to delete test appointments so the Availability Testing Tool can clear them
CREATE POLICY "Admins can delete test appointments"
ON public.salon_appointments
FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND customer_name IN ('Test Customer', 'TEST APPOINTMENT', 'Test')
);