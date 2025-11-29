-- Add founder tier to creative_tier enum
ALTER TYPE creative_tier ADD VALUE IF NOT EXISTS 'founder' BEFORE 'pro';

-- Add location and specialties columns to staff_members
ALTER TABLE staff_members 
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS area TEXT,
ADD COLUMN IF NOT EXISTS specialties TEXT[] DEFAULT '{}';

-- Create index for search performance
CREATE INDEX IF NOT EXISTS idx_staff_members_city ON staff_members(city);
CREATE INDEX IF NOT EXISTS idx_staff_members_area ON staff_members(area);
CREATE INDEX IF NOT EXISTS idx_staff_members_specialties ON staff_members USING GIN(specialties);