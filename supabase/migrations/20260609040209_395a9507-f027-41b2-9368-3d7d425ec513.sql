ALTER TABLE public.organizer_profiles
  ADD COLUMN IF NOT EXISTS mpesa_payout_phone text,
  ADD COLUMN IF NOT EXISTS payout_method text NOT NULL DEFAULT 'paystack';

CREATE TABLE public.organizer_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id uuid NOT NULL REFERENCES public.organizer_profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'admin',
  invited_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organizer_id, user_id)
);
GRANT SELECT, INSERT, UPDATE ON public.organizer_team_members TO authenticated;
GRANT ALL ON public.organizer_team_members TO service_role;
ALTER TABLE public.organizer_team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can join organizer team membership"
ON public.organizer_team_members
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "Team members can view organizer team membership"
ON public.organizer_team_members
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE TABLE public.organizer_admin_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id uuid NOT NULL REFERENCES public.organizer_profiles(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  invited_email text,
  created_by_user_id uuid NOT NULL,
  expires_at timestamptz NOT NULL,
  accepted_by_user_id uuid,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.organizer_admin_invites TO authenticated;
GRANT ALL ON public.organizer_admin_invites TO service_role;
ALTER TABLE public.organizer_admin_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team members can view organizer invites"
ON public.organizer_admin_invites
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.organizer_team_members tm
    WHERE tm.organizer_id = organizer_admin_invites.organizer_id
      AND tm.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "Team members can revoke organizer invites"
ON public.organizer_admin_invites
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.organizer_team_members tm
    WHERE tm.organizer_id = organizer_admin_invites.organizer_id
      AND tm.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.organizer_team_members tm
    WHERE tm.organizer_id = organizer_admin_invites.organizer_id
      AND tm.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
);

CREATE OR REPLACE FUNCTION public.is_organizer_team_member(_organizer_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organizer_team_members tm
    WHERE tm.organizer_id = _organizer_id
      AND tm.user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.ensure_organizer_owner_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.organizer_team_members (organizer_id, user_id, role, invited_by_user_id)
  VALUES (NEW.id, NEW.user_id, 'owner', NEW.user_id)
  ON CONFLICT (organizer_id, user_id) DO UPDATE SET role = 'owner';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_organizer_owner_member ON public.organizer_profiles;
CREATE TRIGGER trg_organizer_owner_member
AFTER INSERT ON public.organizer_profiles
FOR EACH ROW EXECUTE FUNCTION public.ensure_organizer_owner_member();

INSERT INTO public.organizer_team_members (organizer_id, user_id, role, invited_by_user_id)
SELECT op.id, op.user_id, 'owner', op.user_id
FROM public.organizer_profiles op
ON CONFLICT (organizer_id, user_id) DO UPDATE SET role = 'owner';

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

CREATE OR REPLACE FUNCTION public.accept_organizer_admin_invite(_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invite_row public.organizer_admin_invites%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be signed in';
  END IF;

  SELECT * INTO invite_row
  FROM public.organizer_admin_invites
  WHERE token = _token
  LIMIT 1;

  IF invite_row.id IS NULL THEN
    RAISE EXCEPTION 'Invite not found';
  END IF;

  IF invite_row.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invite was revoked';
  END IF;

  IF invite_row.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invite has already been used';
  END IF;

  IF invite_row.expires_at < now() THEN
    RAISE EXCEPTION 'Invite has expired';
  END IF;

  IF invite_row.invited_email IS NOT NULL AND lower(invite_row.invited_email) <> lower(COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), '')) THEN
    RAISE EXCEPTION 'This invite is for a different email address';
  END IF;

  INSERT INTO public.organizer_team_members (organizer_id, user_id, role, invited_by_user_id)
  VALUES (invite_row.organizer_id, auth.uid(), 'admin', invite_row.created_by_user_id)
  ON CONFLICT (organizer_id, user_id) DO NOTHING;

  UPDATE public.organizer_admin_invites
  SET accepted_by_user_id = auth.uid(),
      accepted_at = now(),
      updated_at = now()
  WHERE id = invite_row.id;

  RETURN invite_row.organizer_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.accept_organizer_admin_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_organizer_admin_invite(text) TO service_role;

CREATE TRIGGER trg_organizer_team_members_updated_at
BEFORE UPDATE ON public.organizer_team_members
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_organizer_admin_invites_updated_at
BEFORE UPDATE ON public.organizer_admin_invites
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE POLICY "Team members can update organizer profiles"
ON public.organizer_profiles
FOR UPDATE
TO authenticated
USING (
  public.is_organizer_team_member(id, auth.uid())
  OR public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  public.is_organizer_team_member(id, auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Team members can view own team events"
ON public.events
FOR SELECT
TO authenticated
USING (
  public.is_organizer_team_member(organizer_id, auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Team members can create own team events"
ON public.events
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_organizer_team_member(organizer_id, auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Team members can update own team events"
ON public.events
FOR UPDATE
TO authenticated
USING (
  public.is_organizer_team_member(organizer_id, auth.uid())
  OR public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  public.is_organizer_team_member(organizer_id, auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Team members can delete own team events"
ON public.events
FOR DELETE
TO authenticated
USING (
  public.is_organizer_team_member(organizer_id, auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Team members manage own tiers"
ON public.ticket_tiers
FOR ALL
TO authenticated
USING (
  event_id IN (
    SELECT e.id
    FROM public.events e
    WHERE public.is_organizer_team_member(e.organizer_id, auth.uid())
  )
  OR public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  event_id IN (
    SELECT e.id
    FROM public.events e
    WHERE public.is_organizer_team_member(e.organizer_id, auth.uid())
  )
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Team members can view organizer orders"
ON public.orders
FOR SELECT
TO authenticated
USING (
  event_id IN (
    SELECT e.id
    FROM public.events e
    WHERE public.is_organizer_team_member(e.organizer_id, auth.uid())
  )
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Team members can view organizer tickets"
ON public.tickets
FOR SELECT
TO authenticated
USING (
  event_id IN (
    SELECT e.id
    FROM public.events e
    WHERE public.is_organizer_team_member(e.organizer_id, auth.uid())
  )
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Team members can update organizer tickets"
ON public.tickets
FOR UPDATE
TO authenticated
USING (
  event_id IN (
    SELECT e.id
    FROM public.events e
    WHERE public.is_organizer_team_member(e.organizer_id, auth.uid())
  )
  OR public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  event_id IN (
    SELECT e.id
    FROM public.events e
    WHERE public.is_organizer_team_member(e.organizer_id, auth.uid())
  )
  OR public.has_role(auth.uid(), 'admin')
);