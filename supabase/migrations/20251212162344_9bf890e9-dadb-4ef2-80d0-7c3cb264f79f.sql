-- Add policy to allow staff to manage their own personal terminal settings
CREATE POLICY "Staff can manage own terminal settings" 
ON public.terminal_settings 
FOR ALL 
USING (
  staff_id IS NOT NULL AND 
  EXISTS (
    SELECT 1 FROM staff_members 
    WHERE staff_members.id = terminal_settings.staff_id 
    AND staff_members.user_id = auth.uid()
  )
)
WITH CHECK (
  staff_id IS NOT NULL AND 
  EXISTS (
    SELECT 1 FROM staff_members 
    WHERE staff_members.id = terminal_settings.staff_id 
    AND staff_members.user_id = auth.uid()
  )
);