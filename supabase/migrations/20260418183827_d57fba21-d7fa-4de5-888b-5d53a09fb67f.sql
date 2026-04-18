-- Make business_id nullable (admin isn't tied to a business)
ALTER TABLE public.user_roles ALTER COLUMN business_id DROP NOT NULL;

-- Grant admin to stuart@lunch.team by email lookup
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role
FROM auth.users
WHERE email = 'stuart@lunch.team'
ON CONFLICT (user_id, role) DO NOTHING;