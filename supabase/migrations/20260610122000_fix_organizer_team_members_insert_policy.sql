GRANT INSERT, UPDATE ON public.organizer_team_members TO authenticated;

DROP POLICY IF EXISTS "Users can join organizer team membership" ON public.organizer_team_members;

CREATE POLICY "Users can join organizer team membership"
ON public.organizer_team_members
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
);
