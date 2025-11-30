-- Create staff_invites table
CREATE TABLE public.staff_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_member_id uuid NOT NULL REFERENCES public.staff_members(id) ON DELETE CASCADE,
  phone text NOT NULL,
  invite_token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.staff_invites ENABLE ROW LEVEL SECURITY;

-- Policy: Business owners and admins can view invites for their staff
CREATE POLICY "Business owners can view staff invites"
ON public.staff_invites
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM staff_members sm
    JOIN business_accounts ba ON ba.id = sm.business_id
    WHERE sm.id = staff_invites.staff_member_id
    AND ba.owner_user_id = auth.uid()
  )
);

-- Policy: Admins can manage all invites
CREATE POLICY "Admins can manage staff invites"
ON public.staff_invites
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'::app_role
  )
);

-- Policy: System can create and update invites
CREATE POLICY "System can manage invites"
ON public.staff_invites
FOR ALL
USING (true);

-- Create index for faster lookups
CREATE INDEX idx_staff_invites_token ON public.staff_invites(invite_token);
CREATE INDEX idx_staff_invites_staff_member ON public.staff_invites(staff_member_id);

-- Add trigger for updated_at
CREATE TRIGGER update_staff_invites_updated_at
BEFORE UPDATE ON public.staff_invites
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();