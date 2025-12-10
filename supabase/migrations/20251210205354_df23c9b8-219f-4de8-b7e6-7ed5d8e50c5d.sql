-- Fix database functions missing search_path protection

-- Fix trigger_update_staff_rating
CREATE OR REPLACE FUNCTION public.trigger_update_staff_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Update rating for new/updated feedback
  IF NEW.staff_id IS NOT NULL THEN
    PERFORM update_staff_rating(NEW.staff_id);
  END IF;
  
  -- If staff_id changed, update old staff too
  IF TG_OP = 'UPDATE' AND OLD.staff_id IS NOT NULL AND OLD.staff_id != NEW.staff_id THEN
    PERFORM update_staff_rating(OLD.staff_id);
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Fix check_tier_upgrade
CREATE OR REPLACE FUNCTION public.check_tier_upgrade()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
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
$function$;

-- Fix update_creative_metrics_on_booking
CREATE OR REPLACE FUNCTION public.update_creative_metrics_on_booking()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
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
$function$;

-- Fix handle_first_user_admin
CREATE OR REPLACE FUNCTION public.handle_first_user_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF (SELECT count(*) FROM auth.users) = 1 THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin'::app_role);
  END IF;
  RETURN NEW;
END;
$function$;

-- Fix update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;