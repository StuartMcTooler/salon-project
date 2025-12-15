-- Phase 1: Database Schema Updates for Smart Slots Enhancement

-- 1.1 Add master "Kill Switch" toggle to business_accounts
ALTER TABLE public.business_accounts 
ADD COLUMN smart_slots_enabled BOOLEAN DEFAULT true;

-- 1.2 Make staff_id nullable in smart_slot_rules (for shop-wide rules)
ALTER TABLE public.smart_slot_rules 
ALTER COLUMN staff_id DROP NOT NULL;

-- 1.3 Add business_id column for shop-wide rules
ALTER TABLE public.smart_slot_rules 
ADD COLUMN business_id UUID REFERENCES public.business_accounts(id) ON DELETE CASCADE;

-- 1.4 Add CHECK constraint: must have EITHER staff_id OR business_id (XOR logic)
ALTER TABLE public.smart_slot_rules 
ADD CONSTRAINT smart_slot_rules_scope_check 
CHECK (
  (staff_id IS NOT NULL AND business_id IS NULL) OR 
  (staff_id IS NULL AND business_id IS NOT NULL)
);

-- 1.5 Add index for business_id lookups
CREATE INDEX idx_smart_slot_rules_business_id ON public.smart_slot_rules(business_id);

-- 1.6 Update RLS policy for business owners to manage shop-wide rules
CREATE POLICY "Business owners can manage shop-wide smart slot rules" 
ON public.smart_slot_rules 
FOR ALL 
USING (
  business_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.business_accounts
    WHERE business_accounts.id = smart_slot_rules.business_id
    AND business_accounts.owner_user_id = auth.uid()
  )
);

-- 1.7 Public can view active shop-wide rules
CREATE POLICY "Public can view active shop-wide smart slot rules" 
ON public.smart_slot_rules 
FOR SELECT 
USING (
  is_active = true AND business_id IS NOT NULL
);