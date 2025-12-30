-- =====================================================
-- PARTNER PROGRAM DATABASE FOUNDATION
-- =====================================================

-- 1. Commission Tiers Table (for grandfathering different cohorts)
CREATE TABLE public.commission_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, -- 'founder_2025', 'standard_2026', etc.
  commission_per_booking NUMERIC(10,2) NOT NULL DEFAULT 0.27,
  market_code TEXT DEFAULT 'default', -- 'dublin', 'london', 'default'
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.commission_tiers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for commission_tiers
CREATE POLICY "Admins can manage commission tiers"
ON public.commission_tiers FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view active commission tiers"
ON public.commission_tiers FOR SELECT
USING (true);

-- 2. Campaign Configs Table (for special invite codes and bonus configurations)
CREATE TABLE public.campaign_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_code TEXT UNIQUE NOT NULL,
  switching_bonus_per_booking NUMERIC(10,2) DEFAULT 1.00,
  switching_bonus_cap INTEGER DEFAULT 400,
  double_sided_bonus NUMERIC(10,2) DEFAULT 50.00,
  bonus_trigger_bookings INTEGER DEFAULT 5,
  is_active BOOLEAN DEFAULT true,
  demo_access_token TEXT, -- For stealth marketing access tokens
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.campaign_configs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for campaign_configs
CREATE POLICY "Admins can manage campaign configs"
ON public.campaign_configs FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view active campaigns"
ON public.campaign_configs FOR SELECT
USING (is_active = true);

-- 3. Switching Bonus Ledger (tracks per-booking bonuses for switchers)
CREATE TABLE public.switching_bonus_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creative_id UUID REFERENCES public.staff_members(id) NOT NULL,
  campaign_code TEXT,
  appointment_id UUID REFERENCES public.salon_appointments(id),
  bonus_amount NUMERIC(10,2) NOT NULL,
  cumulative_count INTEGER NOT NULL, -- tracks progress toward cap
  status TEXT DEFAULT 'pending', -- 'pending', 'paid'
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.switching_bonus_ledger ENABLE ROW LEVEL SECURITY;

-- RLS Policies for switching_bonus_ledger
CREATE POLICY "Creatives can view their own bonus ledger"
ON public.switching_bonus_ledger FOR SELECT
USING (EXISTS (
  SELECT 1 FROM staff_members 
  WHERE staff_members.id = switching_bonus_ledger.creative_id 
  AND staff_members.user_id = auth.uid()
));

CREATE POLICY "Admins can manage bonus ledger"
ON public.switching_bonus_ledger FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert bonus entries"
ON public.switching_bonus_ledger FOR INSERT
WITH CHECK (true);

-- 4. Payment Method Fingerprints (PCI-compliant tracking for anti-gaming)
CREATE TABLE public.payment_method_fingerprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creative_id UUID REFERENCES public.staff_members(id) NOT NULL,
  invited_by_creative_id UUID REFERENCES public.staff_members(id),
  fingerprint_hash TEXT NOT NULL, -- SHA-256 hash of Stripe payment_method.id
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(creative_id, fingerprint_hash)
);

-- Enable RLS
ALTER TABLE public.payment_method_fingerprints ENABLE ROW LEVEL SECURITY;

-- RLS Policies for payment_method_fingerprints
CREATE POLICY "Creatives can view their own fingerprints"
ON public.payment_method_fingerprints FOR SELECT
USING (EXISTS (
  SELECT 1 FROM staff_members 
  WHERE staff_members.id = payment_method_fingerprints.creative_id 
  AND staff_members.user_id = auth.uid()
));

CREATE POLICY "Admins can view all fingerprints"
ON public.payment_method_fingerprints FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert fingerprints"
ON public.payment_method_fingerprints FOR INSERT
WITH CHECK (true);

-- 5. Add columns to staff_members for tier assignment
ALTER TABLE public.staff_members 
ADD COLUMN IF NOT EXISTS commission_tier_id UUID REFERENCES public.commission_tiers(id),
ADD COLUMN IF NOT EXISTS campaign_code TEXT;

-- 6. Add columns to referral_codes for legacy handling
ALTER TABLE public.referral_codes 
ADD COLUMN IF NOT EXISTS discount_type TEXT DEFAULT 'fixed', -- 'fixed' or 'percentage'
ADD COLUMN IF NOT EXISTS discount_value NUMERIC(10,2) DEFAULT 10.00,
ADD COLUMN IF NOT EXISTS is_legacy BOOLEAN DEFAULT false;

-- 7. Add columns to creative_invites for anti-gaming
ALTER TABLE public.creative_invites 
ADD COLUMN IF NOT EXISTS unique_payment_methods_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS bonus_qualification_met_at TIMESTAMPTZ;

-- 8. Insert default commission tiers
INSERT INTO public.commission_tiers (name, commission_per_booking, market_code, is_default)
VALUES 
  ('founder_2025', 0.27, 'default', true),
  ('standard_2026', 0.20, 'default', false),
  ('aggressive_dublin', 2.00, 'dublin', false),
  ('aggressive_london', 2.00, 'london', false);

-- 9. Insert default campaign configs
INSERT INTO public.campaign_configs (campaign_code, switching_bonus_per_booking, switching_bonus_cap, double_sided_bonus, bonus_trigger_bookings, demo_access_token)
VALUES 
  ('standard_2025', 1.00, 400, 50.00, 5, NULL),
  ('aggressive_2025', 2.00, 800, 50.00, 5, NULL),
  ('demo_alpha_2025', 1.00, 400, 50.00, 5, 'alpha_2025');

-- 10. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_switching_bonus_creative ON public.switching_bonus_ledger(creative_id);
CREATE INDEX IF NOT EXISTS idx_switching_bonus_status ON public.switching_bonus_ledger(status);
CREATE INDEX IF NOT EXISTS idx_payment_fingerprints_creative ON public.payment_method_fingerprints(creative_id);
CREATE INDEX IF NOT EXISTS idx_staff_commission_tier ON public.staff_members(commission_tier_id);
CREATE INDEX IF NOT EXISTS idx_campaign_code ON public.campaign_configs(campaign_code);