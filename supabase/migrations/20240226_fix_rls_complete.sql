-- Complete RLS fix - disable, clean up, and re-enable with safe policies

-- Temporarily disable RLS on affected tables
ALTER TABLE public.my_teams DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.players DISABLE ROW LEVEL SECURITY;

-- Drop ALL policies on my_teams
DROP POLICY IF EXISTS "Owners can manage own teams" ON public.my_teams;
DROP POLICY IF EXISTS "Members can view teams" ON public.my_teams;
DROP POLICY IF EXISTS "Users can manage own teams" ON public.my_teams;

-- Drop ALL policies on team_members  
DROP POLICY IF EXISTS "Owners can manage team members" ON public.team_members;
DROP POLICY IF EXISTS "Users can view own memberships" ON public.team_members;

-- Drop ALL policies on players
DROP POLICY IF EXISTS "Owners can manage players in own teams" ON public.players;
DROP POLICY IF EXISTS "Members can view players" ON public.players;
DROP POLICY IF EXISTS "Players can update own slot" ON public.players;
DROP POLICY IF EXISTS "Users can manage players in own teams" ON public.players;

-- Re-enable RLS
ALTER TABLE public.my_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

-- Create simple, non-recursive policies

-- MY_TEAMS: Owners have full access (simple, no joins)
CREATE POLICY "my_teams_owner_all" ON public.my_teams
  FOR ALL USING (user_id = auth.uid());

-- TEAM_MEMBERS: Users see their own memberships (no join needed)
CREATE POLICY "team_members_own_select" ON public.team_members
  FOR SELECT USING (user_id = auth.uid());

-- TEAM_MEMBERS: Team owners can manage members
-- Use a subquery that doesn't trigger my_teams RLS (since we're checking user_id directly)
CREATE POLICY "team_members_owner_all" ON public.team_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.my_teams t 
      WHERE t.id = team_members.team_id 
      AND t.user_id = auth.uid()
    )
  );

-- PLAYERS: Team owners can manage
CREATE POLICY "players_owner_all" ON public.players
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.my_teams t 
      WHERE t.id = players.team_id 
      AND t.user_id = auth.uid()
    )
  );

-- For member access to teams they belong to, we use a security definer function
-- to avoid the recursion issue

CREATE OR REPLACE FUNCTION public.get_user_team_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
$$;

-- MY_TEAMS: Members can view (using function to avoid recursion)
CREATE POLICY "my_teams_member_select" ON public.my_teams
  FOR SELECT USING (
    id IN (SELECT public.get_user_team_ids())
  );

-- PLAYERS: Members can view
CREATE POLICY "players_member_select" ON public.players
  FOR SELECT USING (
    team_id IN (SELECT public.get_user_team_ids())
  );

-- PLAYERS: Assigned players can update their slot
CREATE OR REPLACE FUNCTION public.get_user_player_slot_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT player_slot_id FROM public.team_members 
  WHERE user_id = auth.uid() 
  AND role = 'player' 
  AND player_slot_id IS NOT NULL
$$;

CREATE POLICY "players_assigned_update" ON public.players
  FOR UPDATE USING (
    id IN (SELECT public.get_user_player_slot_ids())
  );
