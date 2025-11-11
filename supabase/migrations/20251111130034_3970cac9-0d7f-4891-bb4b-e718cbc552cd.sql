-- Phase 1: Make booking data publicly viewable

-- Allow public viewing of active staff members
DROP POLICY IF EXISTS "Staff members viewable by everyone" ON staff_members;
CREATE POLICY "Staff members viewable by everyone" 
ON staff_members FOR SELECT 
USING (is_active = true);

-- Allow public viewing of active services
DROP POLICY IF EXISTS "Services viewable by everyone" ON services;
CREATE POLICY "Services viewable by everyone" 
ON services FOR SELECT 
USING (is_active = true);

-- Allow public viewing of active service categories
DROP POLICY IF EXISTS "Service categories viewable by everyone" ON service_categories;
CREATE POLICY "Service categories viewable by everyone" 
ON service_categories FOR SELECT 
USING (is_active = true);

-- Allow public viewing of staff pricing
DROP POLICY IF EXISTS "Staff pricing viewable by everyone" ON staff_service_pricing;
CREATE POLICY "Staff pricing viewable by everyone" 
ON staff_service_pricing FOR SELECT 
USING (is_available = true);

-- Allow public viewing of business hours
DROP POLICY IF EXISTS "Everyone can view active business hours" ON business_hours;
CREATE POLICY "Everyone can view active business hours" 
ON business_hours FOR SELECT 
USING (is_active = true);

-- Allow public viewing of active businesses
DROP POLICY IF EXISTS "Public can view active businesses" ON business_accounts;
CREATE POLICY "Public can view active businesses" 
ON business_accounts FOR SELECT 
USING (is_active = true);

-- Allow public creation of appointments (for walk-ins/public bookings)
DROP POLICY IF EXISTS "Public can create appointments" ON salon_appointments;
CREATE POLICY "Public can create appointments" 
ON salon_appointments FOR INSERT 
WITH CHECK (true);

-- Allow public to view referral codes (needed for validation)
DROP POLICY IF EXISTS "Public can view referral codes" ON referral_codes;
CREATE POLICY "Public can view referral codes" 
ON referral_codes FOR SELECT 
USING (true);

-- Allow public insertion of client ownership (for tracking referrals)
DROP POLICY IF EXISTS "Public can tag clients" ON client_ownership;
CREATE POLICY "Public can tag clients" 
ON client_ownership FOR INSERT 
WITH CHECK (true);

-- Phase 2: Allow public creation of user credits (for referral discounts)
DROP POLICY IF EXISTS "Public can create credits" ON user_credits;
CREATE POLICY "Public can create credits" 
ON user_credits FOR INSERT 
WITH CHECK (true);