-- Add is_test_user flag to clients table
ALTER TABLE public.clients 
ADD COLUMN is_test_user boolean DEFAULT false;

-- Add is_test_user flag to staff_members table
ALTER TABLE public.staff_members 
ADD COLUMN is_test_user boolean DEFAULT false;

-- Add index for efficient lookup
CREATE INDEX idx_clients_is_test_user ON public.clients(is_test_user) WHERE is_test_user = true;
CREATE INDEX idx_staff_members_is_test_user ON public.staff_members(is_test_user) WHERE is_test_user = true;