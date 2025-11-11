-- Fix security warnings: Add search_path to functions

-- Fix check_tier_upgrade function
CREATE OR REPLACE FUNCTION check_tier_upgrade()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public
AS $$
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
$$;

-- Fix update_creative_metrics_on_booking function
CREATE OR REPLACE FUNCTION update_creative_metrics_on_booking()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public
AS $$
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
$$;