-- Create staff_availability_overrides table for date-specific schedule changes
CREATE TABLE public.staff_availability_overrides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id UUID NOT NULL REFERENCES public.staff_members(id) ON DELETE CASCADE,
  override_date DATE NOT NULL,
  start_time TIME WITHOUT TIME ZONE,
  end_time TIME WITHOUT TIME ZONE,
  is_available BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Unique constraint: one override per staff member per date
  CONSTRAINT unique_staff_override_date UNIQUE (staff_id, override_date),
  
  -- Check: if available, times must be provided
  CONSTRAINT valid_override_times CHECK (
    (is_available = false) OR 
    (is_available = true AND start_time IS NOT NULL AND end_time IS NOT NULL AND start_time < end_time)
  )
);

-- Enable RLS
ALTER TABLE public.staff_availability_overrides ENABLE ROW LEVEL SECURITY;

-- Staff can manage their own overrides
CREATE POLICY "Staff can manage own overrides"
ON public.staff_availability_overrides
FOR ALL
USING (EXISTS (
  SELECT 1 FROM staff_members
  WHERE staff_members.id = staff_availability_overrides.staff_id
  AND staff_members.user_id = auth.uid()
));

-- Business owners can manage staff overrides
CREATE POLICY "Business owners can manage staff overrides"
ON public.staff_availability_overrides
FOR ALL
USING (EXISTS (
  SELECT 1 FROM staff_members sm
  JOIN business_accounts ba ON ba.id = sm.business_id
  WHERE sm.id = staff_availability_overrides.staff_id
  AND ba.owner_user_id = auth.uid()
));

-- Public can view overrides for availability checking
CREATE POLICY "Public can view overrides for availability"
ON public.staff_availability_overrides
FOR SELECT
USING (true);

-- Create index for fast lookups
CREATE INDEX idx_staff_overrides_staff_date ON public.staff_availability_overrides(staff_id, override_date);

-- Add updated_at trigger
CREATE TRIGGER update_staff_availability_overrides_updated_at
BEFORE UPDATE ON public.staff_availability_overrides
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();