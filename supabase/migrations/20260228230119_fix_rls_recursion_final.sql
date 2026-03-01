-- =============================================================================
-- FIX: infinite recursion in RLS policies for team_members / my_teams
--
-- Root cause: policies on team_members reference my_teams, and policies on
-- my_teams reference team_members, causing cross-table infinite recursion.
--
-- Solution: drop ALL policies on both tables, then recreate them using only
-- SECURITY DEFINER helper functions (which bypass RLS).
-- =============================================================================

-- 1) Drop ALL existing policies on team_members (dynamic, catches any leftovers)
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'team_members'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.team_members', pol.policyname);
    END LOOP;
END $$;

-- 2) Drop ALL existing policies on my_teams
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'my_teams'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.my_teams', pol.policyname);
    END LOOP;
END $$;

-- 3) Drop ALL existing policies on players
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'players'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.players', pol.policyname);
    END LOOP;
END $$;

-- 4) Drop ALL existing policies on team_invites
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'team_invites'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.team_invites', pol.policyname);
    END LOOP;
END $$;

-- 5) Drop ALL existing policies on draft_sessions
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'draft_sessions'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.draft_sessions', pol.policyname);
    END LOOP;
END $$;

-- =============================================================================
-- 6) Drop and recreate SECURITY DEFINER helper functions (bypass RLS)
--    All dependent policies were already dropped above, so CASCADE is safe.
-- =============================================================================

DROP FUNCTION IF EXISTS public.is_team_owner(TEXT, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.is_team_admin(TEXT, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.is_team_member(TEXT, UUID) CASCADE;

CREATE FUNCTION public.is_team_owner(team_id TEXT, user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.my_teams
    WHERE my_teams.id = team_id
    AND my_teams.user_id = is_team_owner.user_id
  );
$$;

CREATE FUNCTION public.is_team_admin(team_id TEXT, user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = is_team_admin.team_id
    AND tm.user_id = is_team_admin.user_id
    AND tm.role = 'admin'
  );
$$;

CREATE FUNCTION public.is_team_member(team_id TEXT, user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = is_team_member.team_id
    AND tm.user_id = is_team_member.user_id
  );
$$;

-- =============================================================================
-- 7) Recreate my_teams policies (NO direct references to team_members)
-- =============================================================================

CREATE POLICY "my_teams_owner_all" ON public.my_teams
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "my_teams_member_select" ON public.my_teams
  FOR SELECT USING (
    public.is_team_member(id, auth.uid())
  );

-- =============================================================================
-- 8) Recreate team_members policies (NO direct references to my_teams)
-- =============================================================================

CREATE POLICY "team_members_own_select" ON public.team_members
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "team_members_owner_all" ON public.team_members
  FOR ALL USING (
    public.is_team_owner(team_id, auth.uid())
  );

CREATE POLICY "team_members_admin_manage" ON public.team_members
  FOR ALL USING (
    public.is_team_admin(team_id, auth.uid())
    AND role != 'owner'
  );

CREATE POLICY "team_members_leave" ON public.team_members
  FOR DELETE USING (
    auth.uid() = user_id
    AND role != 'owner'
  );

-- =============================================================================
-- 9) Recreate players policies
-- =============================================================================

CREATE POLICY "players_owner_all" ON public.players
  FOR ALL USING (
    public.is_team_owner(team_id, auth.uid())
  );

CREATE POLICY "players_admin_all" ON public.players
  FOR ALL USING (
    public.is_team_admin(team_id, auth.uid())
  );

CREATE POLICY "players_member_select" ON public.players
  FOR SELECT USING (
    public.is_team_member(team_id, auth.uid())
  );

-- =============================================================================
-- 10) Recreate team_invites policies
-- =============================================================================

CREATE POLICY "team_invites_owner_all" ON public.team_invites
  FOR ALL USING (
    public.is_team_owner(team_id, auth.uid())
  );

CREATE POLICY "team_invites_admin_all" ON public.team_invites
  FOR ALL USING (
    public.is_team_admin(team_id, auth.uid())
  );

-- =============================================================================
-- 11) Recreate draft_sessions policies
-- =============================================================================

CREATE POLICY "draft_sessions_owner_all" ON public.draft_sessions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "draft_sessions_member_select" ON public.draft_sessions
  FOR SELECT USING (
    my_team_id IS NOT NULL AND
    public.is_team_member(my_team_id, auth.uid())
  );

-- =============================================================================
-- 12) Ensure RLS is enabled on all affected tables
-- =============================================================================
ALTER TABLE public.my_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draft_sessions ENABLE ROW LEVEL SECURITY;
