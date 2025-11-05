-- Create terminal settings table
CREATE TABLE IF NOT EXISTS public.terminal_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  reader_id TEXT NOT NULL,
  reader_name TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.terminal_settings ENABLE ROW LEVEL SECURITY;

-- Business owners can manage their terminal settings
CREATE POLICY "Business owners can manage terminal settings"
ON public.terminal_settings
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM business_accounts
    WHERE business_accounts.id = terminal_settings.business_id
    AND business_accounts.owner_user_id = auth.uid()
  )
);

-- Staff can view their business terminal settings
CREATE POLICY "Staff can view business terminal settings"
ON public.terminal_settings
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM staff_members
    WHERE staff_members.business_id = terminal_settings.business_id
    AND staff_members.user_id = auth.uid()
  )
);

-- Add trigger for updated_at
CREATE TRIGGER update_terminal_settings_updated_at
  BEFORE UPDATE ON public.terminal_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();