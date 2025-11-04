-- Create loyalty program settings table (business-level defaults)
CREATE TABLE public.loyalty_program_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.business_accounts(id) ON DELETE CASCADE,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  points_per_euro_spent NUMERIC NOT NULL DEFAULT 1,
  points_redemption_value NUMERIC NOT NULL DEFAULT 0.01,
  min_points_for_redemption INTEGER NOT NULL DEFAULT 100,
  points_expiry_days INTEGER,
  welcome_bonus_points INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(business_id)
);

-- Create creative loyalty settings table (creative-level overrides)
CREATE TABLE public.creative_loyalty_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  creative_id UUID NOT NULL REFERENCES public.staff_members(id) ON DELETE CASCADE,
  override_points_per_euro NUMERIC,
  override_redemption_value NUMERIC,
  first_visit_bonus INTEGER DEFAULT 0,
  birthday_bonus INTEGER DEFAULT 0,
  referral_bonus INTEGER DEFAULT 0,
  milestone_100_bonus INTEGER DEFAULT 0,
  milestone_500_bonus INTEGER DEFAULT 0,
  milestone_1000_bonus INTEGER DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(creative_id)
);

-- Create customer loyalty points table (balances per creative)
CREATE TABLE public.customer_loyalty_points (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_email TEXT NOT NULL,
  customer_phone TEXT,
  customer_name TEXT NOT NULL,
  creative_id UUID NOT NULL REFERENCES public.staff_members(id) ON DELETE CASCADE,
  current_balance INTEGER NOT NULL DEFAULT 0,
  lifetime_earned INTEGER NOT NULL DEFAULT 0,
  lifetime_redeemed INTEGER NOT NULL DEFAULT 0,
  total_visits INTEGER NOT NULL DEFAULT 0,
  first_visit_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_visit_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(customer_email, creative_id)
);

-- Create loyalty transactions table (audit trail)
CREATE TABLE public.loyalty_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_email TEXT NOT NULL,
  creative_id UUID NOT NULL REFERENCES public.staff_members(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES public.salon_appointments(id) ON DELETE SET NULL,
  transaction_type TEXT NOT NULL,
  points_change INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  booking_amount NUMERIC,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.loyalty_program_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creative_loyalty_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_loyalty_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for loyalty_program_settings
CREATE POLICY "Business owners can manage loyalty settings"
ON public.loyalty_program_settings
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.business_accounts
    WHERE business_accounts.id = loyalty_program_settings.business_id
    AND business_accounts.owner_user_id = auth.uid()
  )
);

CREATE POLICY "Staff can view business loyalty settings"
ON public.loyalty_program_settings
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.staff_members
    WHERE staff_members.business_id = loyalty_program_settings.business_id
    AND staff_members.user_id = auth.uid()
  )
);

-- RLS Policies for creative_loyalty_settings
CREATE POLICY "Creatives can manage own loyalty settings"
ON public.creative_loyalty_settings
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.staff_members
    WHERE staff_members.id = creative_loyalty_settings.creative_id
    AND staff_members.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can view all creative loyalty settings"
ON public.creative_loyalty_settings
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for customer_loyalty_points
CREATE POLICY "Creatives can view their customers' points"
ON public.customer_loyalty_points
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.staff_members
    WHERE staff_members.id = customer_loyalty_points.creative_id
    AND staff_members.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can view all loyalty points"
ON public.customer_loyalty_points
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can manage loyalty points"
ON public.customer_loyalty_points
FOR ALL
USING (true);

-- RLS Policies for loyalty_transactions
CREATE POLICY "Creatives can view their loyalty transactions"
ON public.loyalty_transactions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.staff_members
    WHERE staff_members.id = loyalty_transactions.creative_id
    AND staff_members.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can view all loyalty transactions"
ON public.loyalty_transactions
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert loyalty transactions"
ON public.loyalty_transactions
FOR INSERT
WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_customer_loyalty_points_email ON public.customer_loyalty_points(customer_email);
CREATE INDEX idx_customer_loyalty_points_creative ON public.customer_loyalty_points(creative_id);
CREATE INDEX idx_loyalty_transactions_customer ON public.loyalty_transactions(customer_email);
CREATE INDEX idx_loyalty_transactions_creative ON public.loyalty_transactions(creative_id);
CREATE INDEX idx_loyalty_transactions_appointment ON public.loyalty_transactions(appointment_id);
CREATE INDEX idx_loyalty_transactions_created ON public.loyalty_transactions(created_at DESC);

-- Create triggers for updated_at timestamps
CREATE TRIGGER update_loyalty_program_settings_updated_at
BEFORE UPDATE ON public.loyalty_program_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_creative_loyalty_settings_updated_at
BEFORE UPDATE ON public.creative_loyalty_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_customer_loyalty_points_updated_at
BEFORE UPDATE ON public.customer_loyalty_points
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();