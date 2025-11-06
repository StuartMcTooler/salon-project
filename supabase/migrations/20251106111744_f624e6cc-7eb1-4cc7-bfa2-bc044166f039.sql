-- Add owner policy for staff-specific hours: allow business owners to manage rows with staff_id
DROP POLICY IF EXISTS "Owners can manage staff hours via staff relation" ON public.business_hours;

CREATE POLICY "Owners can manage staff hours via staff relation"
ON public.business_hours
AS PERMISSIVE
FOR ALL
USING (
  staff_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.staff_members s
    JOIN public.business_accounts b ON b.id = s.business_id
    WHERE s.id = business_hours.staff_id
      AND b.owner_user_id = auth.uid()
  )
)
WITH CHECK (
  staff_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.staff_members s
    JOIN public.business_accounts b ON b.id = s.business_id
    WHERE s.id = business_hours.staff_id
      AND b.owner_user_id = auth.uid()
  )
);