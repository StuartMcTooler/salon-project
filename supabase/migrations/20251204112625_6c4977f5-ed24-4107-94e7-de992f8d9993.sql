-- Drop existing foreign key and recreate with ON DELETE SET NULL
ALTER TABLE public.clients 
DROP CONSTRAINT IF EXISTS clients_primary_creative_id_fkey;

ALTER TABLE public.clients 
ADD CONSTRAINT clients_primary_creative_id_fkey 
FOREIGN KEY (primary_creative_id) 
REFERENCES public.staff_members(id) 
ON DELETE SET NULL;