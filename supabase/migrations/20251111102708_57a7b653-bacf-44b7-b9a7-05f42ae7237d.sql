-- Drop the Pro-tier-only restriction on creative invites
DROP POLICY IF EXISTS "Pro creatives can create invite codes" ON creative_invites;

-- Allow all authenticated staff members to create invite codes
CREATE POLICY "Staff members can create invite codes"
ON creative_invites
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM staff_members
    WHERE staff_members.id = creative_invites.inviter_creative_id
    AND staff_members.user_id = auth.uid()
  )
);