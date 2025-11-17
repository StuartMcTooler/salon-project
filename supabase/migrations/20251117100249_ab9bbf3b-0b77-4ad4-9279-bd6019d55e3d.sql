-- Migration Part 1: Schema changes only
-- Add front_desk to app_role enum
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'front_desk';

-- Add audit column to salon_appointments
ALTER TABLE salon_appointments 
ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES auth.users(id);

-- Set default for existing records (assume created by the staff member)
UPDATE salon_appointments 
SET created_by_user_id = (
  SELECT user_id FROM staff_members WHERE id = salon_appointments.staff_id
)
WHERE created_by_user_id IS NULL;

-- Add business_id to user_roles for scoping
ALTER TABLE user_roles 
ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES business_accounts(id);