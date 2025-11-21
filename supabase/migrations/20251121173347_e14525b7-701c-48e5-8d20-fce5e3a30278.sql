-- Add RLS policy for clients to view their own appointments through portal
CREATE POLICY "Clients can view own appointments" 
ON public.salon_appointments 
FOR SELECT 
USING (
  client_id IS NOT NULL 
  AND client_id IN (
    SELECT id FROM public.clients WHERE id = salon_appointments.client_id
  )
);

COMMENT ON POLICY "Clients can view own appointments" ON public.salon_appointments IS 
'Allows client portal to fetch appointments by client_id after session validation';