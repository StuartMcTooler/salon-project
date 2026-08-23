DROP POLICY IF EXISTS "Business owners can manage walk-in settings" ON public.walk_in_settings;
CREATE POLICY "Business owners can manage walk-in settings" ON public.walk_in_settings FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM business_accounts WHERE business_accounts.id = walk_in_settings.business_id AND business_accounts.owner_user_id = auth.uid()));

DROP POLICY IF EXISTS "Business owners can manage loyalty settings" ON public.loyalty_program_settings;
CREATE POLICY "Business owners can manage loyalty settings" ON public.loyalty_program_settings FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM business_accounts WHERE business_accounts.id = loyalty_program_settings.business_id AND business_accounts.owner_user_id = auth.uid()));

DROP POLICY IF EXISTS "Business owners can manage terminal settings" ON public.terminal_settings;
CREATE POLICY "Business owners can manage terminal settings" ON public.terminal_settings FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM business_accounts WHERE business_accounts.id = terminal_settings.business_id AND business_accounts.owner_user_id = auth.uid()));

DROP POLICY IF EXISTS "Business owners can manage business hours" ON public.business_hours;
CREATE POLICY "Business owners can manage business hours" ON public.business_hours FOR ALL TO authenticated
USING ((business_id IS NOT NULL) AND EXISTS (SELECT 1 FROM business_accounts WHERE business_accounts.id = business_hours.business_id AND business_accounts.owner_user_id = auth.uid()))
WITH CHECK ((business_id IS NOT NULL) AND EXISTS (SELECT 1 FROM business_accounts WHERE business_accounts.id = business_hours.business_id AND business_accounts.owner_user_id = auth.uid()));

DROP POLICY IF EXISTS "Business owners can view staff invites" ON public.staff_invites;
CREATE POLICY "Business owners can view staff invites" ON public.staff_invites FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM staff_members sm JOIN business_accounts ba ON ba.id = sm.business_id WHERE sm.id = staff_invites.staff_member_id AND ba.owner_user_id = auth.uid()));

DROP POLICY IF EXISTS "Business owners can manage shop-wide smart slot rules" ON public.smart_slot_rules;
CREATE POLICY "Business owners can manage shop-wide smart slot rules" ON public.smart_slot_rules FOR ALL TO authenticated
USING ((business_id IS NOT NULL) AND EXISTS (SELECT 1 FROM business_accounts WHERE business_accounts.id = smart_slot_rules.business_id AND business_accounts.owner_user_id = auth.uid()));

DROP POLICY IF EXISTS "Business owners can manage staff overrides" ON public.staff_availability_overrides;
CREATE POLICY "Business owners can manage staff overrides" ON public.staff_availability_overrides FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM staff_members sm JOIN business_accounts ba ON ba.id = sm.business_id WHERE sm.id = staff_availability_overrides.staff_id AND ba.owner_user_id = auth.uid()));
