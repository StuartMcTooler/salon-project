-- Allow authenticated salon staff workflows to save client photos from POS.
-- The app inserts client_content directly after uploading to storage, then reads
-- the inserted row back and creates a matching lookbook entry.

DROP POLICY IF EXISTS "Staff can insert managed client content" ON public.client_content;
CREATE POLICY "Staff can insert managed client content"
ON public.client_content
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.staff_members sm
    LEFT JOIN public.business_accounts ba ON ba.id = sm.business_id
    WHERE sm.id = client_content.creative_id
      AND (
        sm.user_id = auth.uid()
        OR ba.owner_user_id = auth.uid()
        OR public.is_front_desk_for_business(auth.uid(), sm.business_id)
      )
  )
);

DROP POLICY IF EXISTS "Staff can update managed client content" ON public.client_content;
CREATE POLICY "Staff can update managed client content"
ON public.client_content
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.staff_members sm
    LEFT JOIN public.business_accounts ba ON ba.id = sm.business_id
    WHERE sm.id = client_content.creative_id
      AND (
        sm.user_id = auth.uid()
        OR ba.owner_user_id = auth.uid()
        OR public.is_front_desk_for_business(auth.uid(), sm.business_id)
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.staff_members sm
    LEFT JOIN public.business_accounts ba ON ba.id = sm.business_id
    WHERE sm.id = client_content.creative_id
      AND (
        sm.user_id = auth.uid()
        OR ba.owner_user_id = auth.uid()
        OR public.is_front_desk_for_business(auth.uid(), sm.business_id)
      )
  )
);

DROP POLICY IF EXISTS "Staff can delete managed client content" ON public.client_content;
CREATE POLICY "Staff can delete managed client content"
ON public.client_content
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.staff_members sm
    LEFT JOIN public.business_accounts ba ON ba.id = sm.business_id
    WHERE sm.id = client_content.creative_id
      AND (
        sm.user_id = auth.uid()
        OR ba.owner_user_id = auth.uid()
        OR public.is_front_desk_for_business(auth.uid(), sm.business_id)
      )
  )
);

DROP POLICY IF EXISTS "Business staff can view managed client content" ON public.client_content;
CREATE POLICY "Business staff can view managed client content"
ON public.client_content
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.staff_members sm
    LEFT JOIN public.business_accounts ba ON ba.id = sm.business_id
    WHERE sm.id = client_content.creative_id
      AND (
        sm.user_id = auth.uid()
        OR ba.owner_user_id = auth.uid()
        OR public.is_front_desk_for_business(auth.uid(), sm.business_id)
      )
  )
);

DROP POLICY IF EXISTS "Staff can insert managed lookbook content" ON public.creative_lookbooks;
CREATE POLICY "Staff can insert managed lookbook content"
ON public.creative_lookbooks
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.staff_members sm
    LEFT JOIN public.business_accounts ba ON ba.id = sm.business_id
    WHERE sm.id = creative_lookbooks.creative_id
      AND (
        sm.user_id = auth.uid()
        OR ba.owner_user_id = auth.uid()
        OR public.is_front_desk_for_business(auth.uid(), sm.business_id)
      )
  )
);

DROP POLICY IF EXISTS "Staff can update managed lookbook content" ON public.creative_lookbooks;
CREATE POLICY "Staff can update managed lookbook content"
ON public.creative_lookbooks
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.staff_members sm
    LEFT JOIN public.business_accounts ba ON ba.id = sm.business_id
    WHERE sm.id = creative_lookbooks.creative_id
      AND (
        sm.user_id = auth.uid()
        OR ba.owner_user_id = auth.uid()
        OR public.is_front_desk_for_business(auth.uid(), sm.business_id)
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.staff_members sm
    LEFT JOIN public.business_accounts ba ON ba.id = sm.business_id
    WHERE sm.id = creative_lookbooks.creative_id
      AND (
        sm.user_id = auth.uid()
        OR ba.owner_user_id = auth.uid()
        OR public.is_front_desk_for_business(auth.uid(), sm.business_id)
      )
  )
);

DROP POLICY IF EXISTS "Staff can delete managed lookbook content" ON public.creative_lookbooks;
CREATE POLICY "Staff can delete managed lookbook content"
ON public.creative_lookbooks
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.staff_members sm
    LEFT JOIN public.business_accounts ba ON ba.id = sm.business_id
    WHERE sm.id = creative_lookbooks.creative_id
      AND (
        sm.user_id = auth.uid()
        OR ba.owner_user_id = auth.uid()
        OR public.is_front_desk_for_business(auth.uid(), sm.business_id)
      )
  )
);
