-- First, let's delete duplicate staff hours entries, keeping only the most recent one per staff/day
WITH ranked_staff_hours AS (
  SELECT id, 
         ROW_NUMBER() OVER (PARTITION BY staff_id, day_of_week ORDER BY created_at DESC) as rn
  FROM business_hours
  WHERE staff_id IS NOT NULL
)
DELETE FROM business_hours
WHERE id IN (
  SELECT id FROM ranked_staff_hours WHERE rn > 1
);

-- Delete duplicate business hours entries, keeping only the most recent one per business/day
WITH ranked_business_hours AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY business_id, day_of_week ORDER BY created_at DESC) as rn
  FROM business_hours
  WHERE business_id IS NOT NULL
)
DELETE FROM business_hours
WHERE id IN (
  SELECT id FROM ranked_business_hours WHERE rn > 1
);

-- Add unique constraints to prevent future duplicates
-- For staff-specific hours
CREATE UNIQUE INDEX IF NOT EXISTS unique_staff_hours 
ON business_hours(staff_id, day_of_week) 
WHERE staff_id IS NOT NULL;

-- For business-level hours  
CREATE UNIQUE INDEX IF NOT EXISTS unique_business_hours
ON business_hours(business_id, day_of_week)
WHERE business_id IS NOT NULL;