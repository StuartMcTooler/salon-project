-- Allow a logged-in user to claim their staff_members row once by matching their display name
-- Normalizes by removing periods and lowercasing to avoid punctuation mismatches (e.g., "Jamie O" vs "Jamie O.")
CREATE POLICY "Users can claim staff by name"
ON public.staff_members
FOR UPDATE
TO authenticated
USING (
  user_id IS NULL
  AND replace(lower(display_name), '.', '') = replace(lower((auth.jwt() -> 'user_metadata' ->> 'name')), '.', '')
)
WITH CHECK (
  user_id = auth.uid()
);
