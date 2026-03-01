-- Allow team members to view all other members of teams they belong to.
-- Previously only "Users can view own memberships" existed, which limited
-- members to seeing only their own row. This lets any member see all
-- members of the same team.

CREATE POLICY "Members can view team members"
  ON public.team_members
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members AS my_membership
      WHERE my_membership.team_id = team_members.team_id
        AND my_membership.user_id = auth.uid()
    )
  );
