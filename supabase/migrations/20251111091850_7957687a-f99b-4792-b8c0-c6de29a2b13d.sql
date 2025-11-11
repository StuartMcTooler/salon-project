-- Phase 1: Database Foundation for Two-Tier Creative System

-- 1.1 Add tier enum
CREATE TYPE creative_tier AS ENUM ('standard', 'pro');

-- 1.2 Add tier columns to staff_members
ALTER TABLE staff_members 
  ADD COLUMN tier creative_tier DEFAULT 'standard',
  ADD COLUMN tier_upgraded_at TIMESTAMPTZ,
  ADD COLUMN total_bookings INTEGER DEFAULT 0,
  ADD COLUMN average_rating NUMERIC(3,2) DEFAULT 0.00;

CREATE INDEX idx_staff_tier ON staff_members(tier);

-- 1.3 Create Performance Metrics Tracker
CREATE TABLE creative_performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creative_id UUID REFERENCES staff_members(id) ON DELETE CASCADE,
  total_completed_bookings INTEGER DEFAULT 0,
  total_revenue NUMERIC(10,2) DEFAULT 0,
  average_rating NUMERIC(3,2) DEFAULT 0.00,
  total_ratings INTEGER DEFAULT 0,
  cancellation_rate NUMERIC(5,2) DEFAULT 0.00,
  last_booking_date TIMESTAMPTZ,
  metrics_updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(creative_id)
);

ALTER TABLE creative_performance_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Creatives can view own metrics"
  ON creative_performance_metrics FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM staff_members 
    WHERE staff_members.id = creative_performance_metrics.creative_id 
    AND staff_members.user_id = auth.uid()
  ));

CREATE POLICY "System can manage metrics"
  ON creative_performance_metrics FOR ALL
  USING (true);

-- 1.4 Create Tier Upgrade Trigger
CREATE OR REPLACE FUNCTION check_tier_upgrade()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.total_completed_bookings >= 50 
     AND NEW.average_rating >= 4.8 
     AND (SELECT tier FROM staff_members WHERE id = NEW.creative_id) = 'standard' THEN
    
    UPDATE staff_members 
    SET 
      tier = 'pro',
      tier_upgraded_at = now()
    WHERE id = NEW.creative_id;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tier_upgrade_check
  AFTER UPDATE ON creative_performance_metrics
  FOR EACH ROW
  EXECUTE FUNCTION check_tier_upgrade();

-- 1.5 Update Metrics on Booking Completion
CREATE OR REPLACE FUNCTION update_creative_metrics_on_booking()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    
    INSERT INTO creative_performance_metrics (creative_id, total_completed_bookings, total_revenue, last_booking_date)
    VALUES (NEW.staff_id, 1, NEW.price, NEW.appointment_date)
    ON CONFLICT (creative_id) DO UPDATE SET
      total_completed_bookings = creative_performance_metrics.total_completed_bookings + 1,
      total_revenue = creative_performance_metrics.total_revenue + NEW.price,
      last_booking_date = NEW.appointment_date,
      metrics_updated_at = now();
    
    UPDATE staff_members
    SET 
      total_bookings = COALESCE(total_bookings, 0) + 1
    WHERE id = NEW.staff_id;
      
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER track_booking_completion
  AFTER UPDATE ON salon_appointments
  FOR EACH ROW
  EXECUTE FUNCTION update_creative_metrics_on_booking();

-- 1.6 Update RLS Policies for Tier-Gated Features
DROP POLICY IF EXISTS "Creatives can manage their own client list" ON client_ownership;
CREATE POLICY "Pro creatives can manage client ownership"
  ON client_ownership FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM staff_members 
      WHERE staff_members.id = client_ownership.creative_id 
      AND staff_members.user_id = auth.uid()
      AND staff_members.tier = 'pro'
    )
  );

DROP POLICY IF EXISTS "Creatives can manage their own terms" ON creative_referral_terms;
CREATE POLICY "Pro creatives can manage referral terms"
  ON creative_referral_terms FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM staff_members 
      WHERE staff_members.id = creative_referral_terms.creative_id 
      AND staff_members.user_id = auth.uid()
      AND staff_members.tier = 'pro'
    )
  );

DROP POLICY IF EXISTS "Creatives can create invite codes" ON creative_invites;
CREATE POLICY "Pro creatives can create invite codes"
  ON creative_invites FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff_members 
      WHERE staff_members.id = creative_invites.inviter_creative_id 
      AND staff_members.user_id = auth.uid()
      AND staff_members.tier = 'pro'
    )
  );

-- 1.7 Admin Override Function
CREATE OR REPLACE FUNCTION manually_upgrade_to_pro(
  _staff_id UUID,
  _admin_user_id UUID
)
RETURNS VOID AS $$
BEGIN
  IF NOT public.has_role(_admin_user_id, 'admin') THEN
    RAISE EXCEPTION 'Only admins can manually upgrade tiers';
  END IF;
  
  UPDATE staff_members 
  SET 
    tier = 'pro',
    tier_upgraded_at = now()
  WHERE id = _staff_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 1.8 Set existing users to standard tier
UPDATE staff_members SET tier = 'standard' WHERE tier IS NULL;