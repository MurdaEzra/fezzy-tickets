CREATE OR REPLACE FUNCTION public.create_organizer_admin_invite(_organizer_id uuid, _invited_email text DEFAULT NULL, _expires_in_hours integer DEFAULT 72)
RETURNS TABLE(token text, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  generated_token text;
  generated_expiry timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be signed in';
  END IF;

  IF NOT public.is_organizer_team_member(_organizer_id, auth.uid()) AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'You do not have access to this organizer';
  END IF;

  generated_token := substr(
    md5(random()::text || clock_timestamp()::text || _organizer_id::text || auth.uid()::text),
    1,
    64
  );
  generated_expiry := now() + make_interval(hours => GREATEST(COALESCE(_expires_in_hours, 72), 1));

  INSERT INTO public.organizer_admin_invites (organizer_id, token, invited_email, created_by_user_id, expires_at)
  VALUES (_organizer_id, generated_token, NULLIF(lower(trim(_invited_email)), ''), auth.uid(), generated_expiry);

  RETURN QUERY SELECT generated_token, generated_expiry;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_organizer_admin_invite(uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_organizer_admin_invite(uuid, text, integer) TO service_role;
