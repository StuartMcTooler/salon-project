-- Add a testing-only availability override field for staff
ALTER TABLE public.staff_members
ADD COLUMN IF NOT EXISTS availability_test_days_from_now integer;

-- No additional RLS needed; existing policies on staff_members already apply.
