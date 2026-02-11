-- Allow solo professionals to create and manage their own services
-- Since services table doesn't have a staff_id/user_id, we'll allow any authenticated user to insert
-- but solo professionals specifically need this for self-service setup

CREATE POLICY "Solo professionals can create services"
ON public.services
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_solo_professional(auth.uid())
);

CREATE POLICY "Solo professionals can update services they use"
ON public.services
FOR UPDATE
TO authenticated
USING (
  public.is_solo_professional(auth.uid())
  AND EXISTS (
    SELECT 1 FROM staff_service_pricing ssp
    JOIN staff_members sm ON sm.id = ssp.staff_id
    WHERE ssp.service_id = services.id
    AND sm.user_id = auth.uid()
  )
)
WITH CHECK (
  public.is_solo_professional(auth.uid())
);
