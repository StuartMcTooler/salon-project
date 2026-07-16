
CREATE OR REPLACE FUNCTION public.find_or_create_booking_client(
  _phone text,
  _email text,
  _name text,
  _creative_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _client_id uuid;
  _staff_exists boolean;
BEGIN
  IF _phone IS NULL OR length(trim(_phone)) = 0 THEN
    RAISE EXCEPTION 'phone required';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.staff_members
    WHERE id = _creative_id AND is_active = true
  ) INTO _staff_exists;

  IF NOT _staff_exists THEN
    RAISE EXCEPTION 'staff not found';
  END IF;

  SELECT id INTO _client_id
  FROM public.clients
  WHERE phone = _phone
  ORDER BY last_visit_date DESC NULLS LAST
  LIMIT 1;

  IF _client_id IS NOT NULL THEN
    UPDATE public.clients
    SET last_visit_date = now(),
        total_visits = COALESCE(total_visits, 0) + 1,
        email = COALESCE(NULLIF(_email, ''), email),
        name = COALESCE(NULLIF(_name, ''), name)
    WHERE id = _client_id;
    RETURN _client_id;
  END IF;

  INSERT INTO public.clients (
    phone, email, name, primary_creative_id,
    first_visit_date, last_visit_date, total_visits
  ) VALUES (
    _phone, NULLIF(_email, ''), _name, _creative_id,
    now(), now(), 1
  )
  RETURNING id INTO _client_id;

  RETURN _client_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.find_or_create_booking_client(text, text, text, uuid) TO anon, authenticated;
