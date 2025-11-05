-- Create business_hours table for configurable hours per business or staff member
CREATE TABLE public.business_hours (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES public.business_accounts(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES public.staff_members(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT business_or_staff_required CHECK (
    (business_id IS NOT NULL AND staff_id IS NULL) OR 
    (business_id IS NULL AND staff_id IS NOT NULL)
  )
);

-- Enable RLS
ALTER TABLE public.business_hours ENABLE ROW LEVEL SECURITY;

-- Business owners can manage business hours
CREATE POLICY "Business owners can manage business hours"
ON public.business_hours
FOR ALL
USING (
  business_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM business_accounts
    WHERE business_accounts.id = business_hours.business_id
    AND business_accounts.owner_user_id = auth.uid()
  )
);

-- Staff can manage their own hours
CREATE POLICY "Staff can manage own hours"
ON public.business_hours
FOR ALL
USING (
  staff_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM staff_members
    WHERE staff_members.id = business_hours.staff_id
    AND staff_members.user_id = auth.uid()
  )
);

-- Everyone can view active business hours
CREATE POLICY "Everyone can view active business hours"
ON public.business_hours
FOR SELECT
USING (is_active = true);

-- Add updated_at trigger
CREATE TRIGGER update_business_hours_updated_at
BEFORE UPDATE ON public.business_hours
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for appointments
ALTER PUBLICATION supabase_realtime ADD TABLE public.salon_appointments;

-- Add index for better query performance
CREATE INDEX idx_business_hours_business_id ON public.business_hours(business_id) WHERE business_id IS NOT NULL;
CREATE INDEX idx_business_hours_staff_id ON public.business_hours(staff_id) WHERE staff_id IS NOT NULL;
CREATE INDEX idx_business_hours_day ON public.business_hours(day_of_week, is_active);