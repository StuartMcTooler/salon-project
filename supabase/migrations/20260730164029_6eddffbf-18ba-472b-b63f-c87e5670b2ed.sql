GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_content TO authenticated;
GRANT ALL ON public.client_content TO service_role;

CREATE POLICY "Creatives can insert own content"
ON public.client_content
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.staff_members sm
    WHERE sm.id = client_content.creative_id
      AND sm.user_id = auth.uid()
  )
);

CREATE POLICY "Creatives can update own content"
ON public.client_content
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.staff_members sm
    WHERE sm.id = client_content.creative_id
      AND sm.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.staff_members sm
    WHERE sm.id = client_content.creative_id
      AND sm.user_id = auth.uid()
  )
);

CREATE POLICY "Creatives can delete own content"
ON public.client_content
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.staff_members sm
    WHERE sm.id = client_content.creative_id
      AND sm.user_id = auth.uid()
  )
);