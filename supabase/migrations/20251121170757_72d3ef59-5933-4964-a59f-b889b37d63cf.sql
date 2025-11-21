-- Add direct appointment link to client_content
ALTER TABLE public.client_content 
ADD COLUMN appointment_id UUID REFERENCES public.salon_appointments(id);

-- Create index for performance
CREATE INDEX idx_client_content_appointment_id 
ON public.client_content(appointment_id);

-- Make request_id nullable (in-service photos won't have a content request)
ALTER TABLE public.client_content 
ALTER COLUMN request_id DROP NOT NULL;