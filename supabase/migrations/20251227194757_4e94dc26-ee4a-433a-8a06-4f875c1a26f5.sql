-- Create admin_audit_logs table for tracking super admin actions
CREATE TABLE public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  user_email text NOT NULL,
  action text NOT NULL,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- Only super admins can view audit logs
CREATE POLICY "Super admins can view audit logs" ON public.admin_audit_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- Super admins can insert audit logs
CREATE POLICY "Super admins can insert audit logs" ON public.admin_audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Assign super_admin role to stuart@lunch.team
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'super_admin'::app_role
FROM auth.users
WHERE email = 'stuart@lunch.team'
ON CONFLICT (user_id, role) DO NOTHING;