-- Phase 1: Smart Slots Database Schema

-- Create smart_slot_rules table for dynamic pricing
CREATE TABLE public.smart_slot_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.staff_members(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday, 6=Saturday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('discount', 'premium')),
  modifier_percentage INTEGER NOT NULL CHECK (modifier_percentage > 0 AND modifier_percentage <= 100),
  require_deposit BOOLEAN DEFAULT false,
  deposit_amount NUMERIC CHECK (deposit_amount >= 0),
  label TEXT, -- "Happy Hour", "Prime Time", "Christmas Eve Special"
  priority INTEGER NOT NULL DEFAULT 0, -- Higher priority wins when rules overlap
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.smart_slot_rules ENABLE ROW LEVEL SECURITY;

-- RLS: Staff can manage their own smart slot rules
CREATE POLICY "Staff can manage own smart slot rules" ON public.smart_slot_rules
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.staff_members WHERE id = smart_slot_rules.staff_id AND user_id = auth.uid())
  );

-- RLS: Public can view active rules for booking page
CREATE POLICY "Public can view active smart slot rules" ON public.smart_slot_rules
  FOR SELECT USING (is_active = true);

-- Add list_price column to salon_appointments for analytics
-- list_price = original price before smart pricing
-- price = final price customer pays (after discount or surge)
ALTER TABLE public.salon_appointments ADD COLUMN list_price NUMERIC;

-- Create index for efficient rule lookups
CREATE INDEX idx_smart_slot_rules_staff_day ON public.smart_slot_rules(staff_id, day_of_week) WHERE is_active = true;

-- Add trigger for updated_at
CREATE TRIGGER update_smart_slot_rules_updated_at
  BEFORE UPDATE ON public.smart_slot_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();