-- Fix RLS recursion between my_teams and team_members
-- The issue: my_teams policy references team_members, team_members policy references my_teams

-- ============================================
-- CREATE SECURITY DEFINER HELPER FUNCTIONS
-- These bypass RLS to prevent infinite recursion
-- ============================================

-- Check if user is owner of a team (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_team_owner(team_id TEXT, user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.my_teams
    WHERE my_teams.id = team_id
    AND my_teams.user_id = user_id
  );
$$;

-- Check if user is member of a team (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_team_member(team_id TEXT, user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_members.team_id = $1
    AND team_members.user_id = $2
  );
$$;

-- Check if user owns enemy team (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_enemy_team_owner(team_id TEXT, user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.enemy_teams
    WHERE enemy_teams.id = team_id
    AND enemy_teams.user_id = user_id
  );
$$;

-- ============================================
-- DROP EXISTING PROBLEMATIC POLICIES
-- ============================================

-- my_teams
DROP POLICY IF EXISTS "Owners can manage own teams" ON public.my_teams;
DROP POLICY IF EXISTS "Members can view teams" ON public.my_teams;

-- players
DROP POLICY IF EXISTS "Owners can manage players in own teams" ON public.players;
DROP POLICY IF EXISTS "Members can view players" ON public.players;
DROP POLICY IF EXISTS "Players can update own slot" ON public.players;

-- enemy_teams
DROP POLICY IF EXISTS "Owners can manage own enemy teams" ON public.enemy_teams;
DROP POLICY IF EXISTS "Members can view enemy teams via drafts" ON public.enemy_teams;

-- enemy_players
DROP POLICY IF EXISTS "Owners can manage enemy players" ON public.enemy_players;
DROP POLICY IF EXISTS "Members can view enemy players via drafts" ON public.enemy_players;

-- draft_sessions
DROP POLICY IF EXISTS "Owners can manage own draft sessions" ON public.draft_sessions;
DROP POLICY IF EXISTS "Members can view team draft sessions" ON public.draft_sessions;

-- team_members
DROP POLICY IF EXISTS "Owners can manage team members" ON public.team_members;
DROP POLICY IF EXISTS "Users can view own memberships" ON public.team_members;

-- ============================================
-- RECREATE POLICIES WITHOUT RECURSION
-- ============================================

-- MY_TEAMS POLICIES
CREATE POLICY "Owners can manage own teams" ON public.my_teams
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Members can view teams" ON public.my_teams
  FOR SELECT USING (
    public.is_team_member(id, auth.uid())
  );

-- PLAYERS POLICIES
CREATE POLICY "Owners can manage players in own teams" ON public.players
  FOR ALL USING (
    public.is_team_owner(team_id, auth.uid())
  );

CREATE POLICY "Members can view players" ON public.players
  FOR SELECT USING (
    public.is_team_member(team_id, auth.uid())
  );

-- ENEMY TEAMS POLICIES
CREATE POLICY "Owners can manage own enemy teams" ON public.enemy_teams
  FOR ALL USING (auth.uid() = user_id);

-- ENEMY PLAYERS POLICIES
CREATE POLICY "Owners can manage enemy players" ON public.enemy_players
  FOR ALL USING (
    public.is_enemy_team_owner(team_id, auth.uid())
  );

-- DRAFT SESSIONS POLICIES
CREATE POLICY "Owners can manage own draft sessions" ON public.draft_sessions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Members can view team draft sessions" ON public.draft_sessions
  FOR SELECT USING (
    my_team_id IS NOT NULL AND
    public.is_team_member(my_team_id, auth.uid())
  );

-- TEAM_MEMBERS POLICIES (use helper function to avoid recursion)
CREATE POLICY "Owners can manage team members" ON public.team_members
  FOR ALL USING (
    public.is_team_owner(team_id, auth.uid())
  );

CREATE POLICY "Users can view own memberships" ON public.team_members
  FOR SELECT USING (auth.uid() = user_id);
