-- Create clients table with permanent client_id
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT UNIQUE NOT NULL,
  email TEXT,
  name TEXT NOT NULL,
  primary_creative_id UUID REFERENCES public.staff_members(id),
  first_visit_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_visit_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  total_visits INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- RLS Policies for clients
CREATE POLICY "Staff can view their clients"
  ON public.clients
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff_members
      WHERE staff_members.id = clients.primary_creative_id
      AND staff_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can create clients"
  ON public.clients
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff_members
      WHERE staff_members.id = clients.primary_creative_id
      AND staff_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can update their clients"
  ON public.clients
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM staff_members
      WHERE staff_members.id = clients.primary_creative_id
      AND staff_members.user_id = auth.uid()
    )
  );

-- Add indexes for fast lookups
CREATE INDEX idx_clients_phone ON public.clients(phone);
CREATE INDEX idx_clients_email ON public.clients(email);
CREATE INDEX idx_clients_primary_creative ON public.clients(primary_creative_id);

-- Add client_id to salon_appointments
ALTER TABLE public.salon_appointments
ADD COLUMN client_id UUID REFERENCES public.clients(id);

CREATE INDEX idx_appointments_client ON public.salon_appointments(client_id);

-- Add client_id to customer_loyalty_points
ALTER TABLE public.customer_loyalty_points
ADD COLUMN client_id UUID REFERENCES public.clients(id);

CREATE INDEX idx_loyalty_client ON public.customer_loyalty_points(client_id);

-- Add client_id to content_requests
ALTER TABLE public.content_requests
ADD COLUMN client_id UUID REFERENCES public.clients(id);

CREATE INDEX idx_content_requests_client ON public.content_requests(client_id);

-- Extend creative_lookbooks table
ALTER TABLE public.creative_lookbooks
ADD COLUMN visibility_type TEXT DEFAULT 'public' CHECK (visibility_type IN ('public', 'private', 'draft')),
ADD COLUMN client_id UUID REFERENCES public.clients(id),
ADD COLUMN service_id UUID REFERENCES public.services(id),
ADD COLUMN service_price NUMERIC,
ADD COLUMN private_notes TEXT,
ADD COLUMN booking_link_enabled BOOLEAN DEFAULT false;

CREATE INDEX idx_lookbooks_visibility ON public.creative_lookbooks(creative_id, visibility_type);
CREATE INDEX idx_lookbooks_client ON public.creative_lookbooks(client_id) WHERE client_id IS NOT NULL;

-- Trigger to update updated_at
CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Migrate existing data: Create clients from salon_appointments
INSERT INTO public.clients (phone, email, name, primary_creative_id, first_visit_date, last_visit_date, total_visits)
SELECT DISTINCT ON (customer_phone, staff_id)
  customer_phone,
  customer_email,
  customer_name,
  staff_id,
  MIN(appointment_date) OVER (PARTITION BY customer_phone, staff_id),
  MAX(appointment_date) OVER (PARTITION BY customer_phone, staff_id),
  COUNT(*) OVER (PARTITION BY customer_phone, staff_id)
FROM public.salon_appointments
WHERE customer_phone IS NOT NULL
  AND staff_id IS NOT NULL
ON CONFLICT (phone) DO NOTHING;

-- Link existing appointments to clients
UPDATE public.salon_appointments sa
SET client_id = c.id
FROM public.clients c
WHERE sa.customer_phone = c.phone
  AND sa.staff_id = c.primary_creative_id;

-- Link existing loyalty points to clients
UPDATE public.customer_loyalty_points clp
SET client_id = c.id
FROM public.clients c
WHERE clp.customer_phone = c.phone
  AND clp.creative_id = c.primary_creative_id;

-- Link existing content requests to clients
UPDATE public.content_requests cr
SET client_id = c.id
FROM public.clients c
WHERE cr.client_phone = c.phone
  AND cr.creative_id = c.primary_creative_id;

-- Set existing creative_lookbooks to public
UPDATE public.creative_lookbooks
SET visibility_type = 'public'
WHERE visibility_type IS NULL;