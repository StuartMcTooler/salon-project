-- Phase 1: Add visibility_scope to client_content and creative_lookbooks

-- Add visibility_scope column to client_content
ALTER TABLE public.client_content 
ADD COLUMN IF NOT EXISTS visibility_scope TEXT DEFAULT 'shared' CHECK (visibility_scope IN ('private', 'shared', 'public'));

-- Add visibility_scope column to creative_lookbooks
ALTER TABLE public.creative_lookbooks 
ADD COLUMN IF NOT EXISTS visibility_scope TEXT DEFAULT 'shared' CHECK (visibility_scope IN ('private', 'shared', 'public'));

-- Create index for faster visibility queries
CREATE INDEX IF NOT EXISTS idx_client_content_visibility ON public.client_content(visibility_scope);
CREATE INDEX IF NOT EXISTS idx_creative_lookbooks_visibility ON public.creative_lookbooks(visibility_scope);

-- Update RLS policies for client_content to respect visibility
DROP POLICY IF EXISTS "System can manage content" ON public.client_content;
CREATE POLICY "System can manage content" ON public.client_content
FOR ALL USING (true);

DROP POLICY IF EXISTS "Creatives can view own content" ON public.client_content;
CREATE POLICY "Creatives can view own content" ON public.client_content
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM staff_members
    WHERE staff_members.id = client_content.creative_id
    AND staff_members.user_id = auth.uid()
  )
);

-- New policy: Clients can view shared and public content via portal
CREATE POLICY "Clients can view shared and public content" ON public.client_content
FOR SELECT USING (
  visibility_scope IN ('shared', 'public')
);

-- Update RLS policies for creative_lookbooks
DROP POLICY IF EXISTS "Public can view featured lookbooks" ON public.creative_lookbooks;
CREATE POLICY "Public can view public lookbooks" ON public.creative_lookbooks
FOR SELECT USING (visibility_scope = 'public');

DROP POLICY IF EXISTS "Creatives can manage own lookbook" ON public.creative_lookbooks;
CREATE POLICY "Creatives can manage own lookbook" ON public.creative_lookbooks
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM staff_members
    WHERE staff_members.id = creative_lookbooks.creative_id
    AND staff_members.user_id = auth.uid()
  )
);

-- Create approval_requests table for batch approvals
CREATE TABLE IF NOT EXISTS public.portfolio_approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creative_id UUID NOT NULL REFERENCES staff_members(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  client_email TEXT NOT NULL,
  client_name TEXT NOT NULL,
  client_phone TEXT,
  content_ids UUID[] NOT NULL,
  token TEXT NOT NULL UNIQUE,
  token_expires_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'expired')),
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on portfolio_approval_requests
ALTER TABLE public.portfolio_approval_requests ENABLE ROW LEVEL SECURITY;

-- RLS: System can manage all approval requests
CREATE POLICY "System can manage approval requests" ON public.portfolio_approval_requests
FOR ALL USING (true);

-- RLS: Creatives can view their own approval requests
CREATE POLICY "Creatives can view own approval requests" ON public.portfolio_approval_requests
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM staff_members
    WHERE staff_members.id = portfolio_approval_requests.creative_id
    AND staff_members.user_id = auth.uid()
  )
);

-- Create index for token lookups
CREATE INDEX IF NOT EXISTS idx_portfolio_approval_token ON public.portfolio_approval_requests(token);
CREATE INDEX IF NOT EXISTS idx_portfolio_approval_status ON public.portfolio_approval_requests(status);