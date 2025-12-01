-- Phase 0: Database Schema Update for Native Terminal Support

-- Step 1: Make columns nullable for flexibility
ALTER TABLE terminal_settings 
  ALTER COLUMN business_id DROP NOT NULL,
  ALTER COLUMN reader_id DROP NOT NULL;

-- Step 2: Add staff-level and connection type support
ALTER TABLE terminal_settings 
  ADD COLUMN staff_id UUID REFERENCES staff_members(id),
  ADD COLUMN connection_type TEXT DEFAULT 'internet';

-- Step 3: Add validation constraints
ALTER TABLE terminal_settings
  ADD CONSTRAINT terminal_settings_connection_type_check 
    CHECK (connection_type IN ('internet', 'bluetooth', 'tap_to_pay')),
  ADD CONSTRAINT terminal_settings_assignment_check
    CHECK (
      (business_id IS NOT NULL AND staff_id IS NULL) OR 
      (business_id IS NULL AND staff_id IS NOT NULL)
    ),
  ADD CONSTRAINT terminal_settings_reader_required_check
    CHECK (
      connection_type = 'tap_to_pay' OR reader_id IS NOT NULL
    );

-- Step 4: Performance index for staff lookups
CREATE INDEX idx_terminal_settings_staff_id 
  ON terminal_settings(staff_id) 
  WHERE staff_id IS NOT NULL;