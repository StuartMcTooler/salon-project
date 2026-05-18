UPDATE public.terminal_settings ts
SET stripe_location_id = NULL
FROM public.staff_members sm
JOIN public.profiles p ON p.id = sm.user_id
WHERE ts.staff_id = sm.id
  AND ts.is_active = true
  AND p.email = 'tim@test.com';