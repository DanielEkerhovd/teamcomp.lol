-- Allow all team members to view every member in teams they belong to.
-- Uses the SECURITY DEFINER helper function to avoid RLS recursion.
-- The fix_rls_recursion_final migration accidentally dropped the earlier
-- "Members can view team members" policy. This restores that capability.

CREATE POLICY "team_members_member_select" ON public.team_members
  FOR SELECT USING (
    public.is_team_member(team_id, auth.uid())
  );
