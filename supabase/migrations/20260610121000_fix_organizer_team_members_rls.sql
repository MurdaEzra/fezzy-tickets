DROP POLICY IF EXISTS "Team members can view organizer team membership" ON public.organizer_team_members;

CREATE POLICY "Team members can view organizer team membership"
ON public.organizer_team_members
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Team members can view organizer invites" ON public.organizer_admin_invites;
DROP POLICY IF EXISTS "Team members can revoke organizer invites" ON public.organizer_admin_invites;

CREATE POLICY "Team members can view organizer invites"
ON public.organizer_admin_invites
FOR SELECT
TO authenticated
USING (
  public.is_organizer_team_member(organizer_admin_invites.organizer_id, auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Team members can revoke organizer invites"
ON public.organizer_admin_invites
FOR UPDATE
TO authenticated
USING (
  public.is_organizer_team_member(organizer_admin_invites.organizer_id, auth.uid())
  OR public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  public.is_organizer_team_member(organizer_admin_invites.organizer_id, auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);
