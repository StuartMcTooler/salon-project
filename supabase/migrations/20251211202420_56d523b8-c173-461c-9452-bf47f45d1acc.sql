-- Allow business owners to insert staff members for their own business
CREATE POLICY "Business owners can insert staff for their business"
ON public.staff_members
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM business_accounts
    WHERE business_accounts.id = staff_members.business_id
    AND business_accounts.owner_user_id = auth.uid()
  )
);

-- Allow business owners to manage (update/delete) staff for their business
CREATE POLICY "Business owners can manage staff for their business"
ON public.staff_members
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM business_accounts
    WHERE business_accounts.id = staff_members.business_id
    AND business_accounts.owner_user_id = auth.uid()
  )
);