-- Migration: Change ID columns from UUID to TEXT to support both UUID and nanoid formats
-- This allows compatibility with older local data that used shorter IDs

-- ============================================
-- DROP ALL POLICIES ON AFFECTED TABLES
-- ============================================

-- Drop all policies on my_teams
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'my_teams'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.my_teams', pol.policyname);
    END LOOP;
END $$;

-- Drop all policies on players
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'players'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.players', pol.policyname);
    END LOOP;
END $$;

-- Drop all policies on enemy_teams
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'enemy_teams'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.enemy_teams', pol.policyname);
    END LOOP;
END $$;

-- Drop all policies on enemy_players
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'enemy_players'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.enemy_players', pol.policyname);
    END LOOP;
END $$;

-- Drop all policies on draft_sessions
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'draft_sessions'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.draft_sessions', pol.policyname);
    END LOOP;
END $$;

-- Drop all policies on team_members
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'team_members'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.team_members', pol.policyname);
    END LOOP;
END $$;

-- Drop all policies on team_invites
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'team_invites'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.team_invites', pol.policyname);
    END LOOP;
END $$;

-- Drop all policies on draft_shares
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'draft_shares'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.draft_shares', pol.policyname);
    END LOOP;
END $$;

-- Drop all policies on player_pools
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'player_pools'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.player_pools', pol.policyname);
    END LOOP;
END $$;

-- Drop all policies on custom_pools
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'custom_pools'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.custom_pools', pol.policyname);
    END LOOP;
END $$;

-- Drop all policies on custom_templates
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'custom_templates'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.custom_templates', pol.policyname);
    END LOOP;
END $$;

-- ============================================
-- DROP FOREIGN KEY CONSTRAINTS
-- ============================================

-- team_members FKs
ALTER TABLE public.team_members DROP CONSTRAINT IF EXISTS team_members_team_id_fkey;
ALTER TABLE public.team_members DROP CONSTRAINT IF EXISTS team_members_player_slot_id_fkey;

-- team_invites FKs
ALTER TABLE public.team_invites DROP CONSTRAINT IF EXISTS team_invites_team_id_fkey;
ALTER TABLE public.team_invites DROP CONSTRAINT IF EXISTS team_invites_player_slot_id_fkey;

-- draft_shares FKs
ALTER TABLE public.draft_shares DROP CONSTRAINT IF EXISTS draft_shares_draft_session_id_fkey;

-- players FKs
ALTER TABLE public.players DROP CONSTRAINT IF EXISTS players_team_id_fkey;

-- enemy_players FKs
ALTER TABLE public.enemy_players DROP CONSTRAINT IF EXISTS enemy_players_team_id_fkey;

-- draft_sessions FKs
ALTER TABLE public.draft_sessions DROP CONSTRAINT IF EXISTS draft_sessions_enemy_team_id_fkey;
ALTER TABLE public.draft_sessions DROP CONSTRAINT IF EXISTS draft_sessions_my_team_id_fkey;

-- ============================================
-- CHANGE ID COLUMN TYPES
-- ============================================

-- my_teams
ALTER TABLE public.my_teams ALTER COLUMN id TYPE TEXT USING id::TEXT;

-- players
ALTER TABLE public.players ALTER COLUMN id TYPE TEXT USING id::TEXT;
ALTER TABLE public.players ALTER COLUMN team_id TYPE TEXT USING team_id::TEXT;

-- enemy_teams
ALTER TABLE public.enemy_teams ALTER COLUMN id TYPE TEXT USING id::TEXT;

-- enemy_players
ALTER TABLE public.enemy_players ALTER COLUMN id TYPE TEXT USING id::TEXT;
ALTER TABLE public.enemy_players ALTER COLUMN team_id TYPE TEXT USING team_id::TEXT;

-- draft_sessions
ALTER TABLE public.draft_sessions ALTER COLUMN id TYPE TEXT USING id::TEXT;
ALTER TABLE public.draft_sessions ALTER COLUMN enemy_team_id TYPE TEXT USING enemy_team_id::TEXT;
ALTER TABLE public.draft_sessions ALTER COLUMN my_team_id TYPE TEXT USING my_team_id::TEXT;

-- player_pools
ALTER TABLE public.player_pools ALTER COLUMN id TYPE TEXT USING id::TEXT;

-- custom_pools
ALTER TABLE public.custom_pools ALTER COLUMN id TYPE TEXT USING id::TEXT;

-- custom_templates
ALTER TABLE public.custom_templates ALTER COLUMN id TYPE TEXT USING id::TEXT;

-- team_members
ALTER TABLE public.team_members ALTER COLUMN team_id TYPE TEXT USING team_id::TEXT;
ALTER TABLE public.team_members ALTER COLUMN player_slot_id TYPE TEXT USING player_slot_id::TEXT;

-- team_invites
ALTER TABLE public.team_invites ALTER COLUMN team_id TYPE TEXT USING team_id::TEXT;
ALTER TABLE public.team_invites ALTER COLUMN player_slot_id TYPE TEXT USING player_slot_id::TEXT;

-- draft_shares
ALTER TABLE public.draft_shares ALTER COLUMN draft_session_id TYPE TEXT USING draft_session_id::TEXT;

-- ============================================
-- RE-ADD FOREIGN KEY CONSTRAINTS
-- ============================================

-- players
ALTER TABLE public.players ADD CONSTRAINT players_team_id_fkey
  FOREIGN KEY (team_id) REFERENCES public.my_teams(id) ON DELETE CASCADE;

-- enemy_players
ALTER TABLE public.enemy_players ADD CONSTRAINT enemy_players_team_id_fkey
  FOREIGN KEY (team_id) REFERENCES public.enemy_teams(id) ON DELETE CASCADE;

-- draft_sessions
ALTER TABLE public.draft_sessions ADD CONSTRAINT draft_sessions_enemy_team_id_fkey
  FOREIGN KEY (enemy_team_id) REFERENCES public.enemy_teams(id) ON DELETE SET NULL;
ALTER TABLE public.draft_sessions ADD CONSTRAINT draft_sessions_my_team_id_fkey
  FOREIGN KEY (my_team_id) REFERENCES public.my_teams(id) ON DELETE SET NULL;

-- team_members
ALTER TABLE public.team_members ADD CONSTRAINT team_members_team_id_fkey
  FOREIGN KEY (team_id) REFERENCES public.my_teams(id) ON DELETE CASCADE;
ALTER TABLE public.team_members ADD CONSTRAINT team_members_player_slot_id_fkey
  FOREIGN KEY (player_slot_id) REFERENCES public.players(id) ON DELETE SET NULL;

-- team_invites
ALTER TABLE public.team_invites ADD CONSTRAINT team_invites_team_id_fkey
  FOREIGN KEY (team_id) REFERENCES public.my_teams(id) ON DELETE CASCADE;
ALTER TABLE public.team_invites ADD CONSTRAINT team_invites_player_slot_id_fkey
  FOREIGN KEY (player_slot_id) REFERENCES public.players(id) ON DELETE SET NULL;

-- draft_shares
ALTER TABLE public.draft_shares ADD CONSTRAINT draft_shares_draft_session_id_fkey
  FOREIGN KEY (draft_session_id) REFERENCES public.draft_sessions(id) ON DELETE CASCADE;

-- ============================================
-- RE-CREATE POLICIES
-- ============================================

-- MY_TEAMS POLICIES
CREATE POLICY "Owners can manage own teams" ON public.my_teams
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Members can view teams" ON public.my_teams
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_members.team_id = my_teams.id
      AND team_members.user_id = auth.uid()
    )
  );

-- PLAYERS POLICIES
CREATE POLICY "Owners can manage players in own teams" ON public.players
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.my_teams
      WHERE my_teams.id = players.team_id
      AND my_teams.user_id = auth.uid()
    )
  );

CREATE POLICY "Members can view players" ON public.players
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.team_members
      INNER JOIN public.my_teams ON my_teams.id = team_members.team_id
      WHERE my_teams.id = players.team_id
      AND team_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Players can update own slot" ON public.players
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_members.player_slot_id = players.id
      AND team_members.user_id = auth.uid()
      AND team_members.role = 'player'
    )
  );

-- ENEMY TEAMS POLICIES
CREATE POLICY "Owners can manage own enemy teams" ON public.enemy_teams
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Members can view enemy teams via drafts" ON public.enemy_teams
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.draft_sessions ds
      INNER JOIN public.team_members tm ON tm.team_id = ds.my_team_id
      WHERE ds.enemy_team_id = enemy_teams.id
      AND tm.user_id = auth.uid()
    )
  );

-- ENEMY PLAYERS POLICIES
CREATE POLICY "Owners can manage enemy players" ON public.enemy_players
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.enemy_teams
      WHERE enemy_teams.id = enemy_players.team_id
      AND enemy_teams.user_id = auth.uid()
    )
  );

CREATE POLICY "Members can view enemy players via drafts" ON public.enemy_players
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.draft_sessions ds
      INNER JOIN public.team_members tm ON tm.team_id = ds.my_team_id
      INNER JOIN public.enemy_teams et ON et.id = ds.enemy_team_id
      WHERE et.id = enemy_players.team_id
      AND tm.user_id = auth.uid()
    )
  );

-- DRAFT SESSIONS POLICIES
CREATE POLICY "Owners can manage own draft sessions" ON public.draft_sessions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Members can view team draft sessions" ON public.draft_sessions
  FOR SELECT USING (
    my_team_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_members.team_id = draft_sessions.my_team_id
      AND team_members.user_id = auth.uid()
    )
  );

-- TEAM MEMBERS POLICIES
CREATE POLICY "Owners can manage team members" ON public.team_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.my_teams
      WHERE my_teams.id = team_members.team_id
      AND my_teams.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view own memberships" ON public.team_members
  FOR SELECT USING (auth.uid() = user_id);

-- TEAM INVITES POLICIES
CREATE POLICY "Owners can manage invites" ON public.team_invites
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.my_teams
      WHERE my_teams.id = team_invites.team_id
      AND my_teams.user_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can read invites" ON public.team_invites
  FOR SELECT USING (TRUE);

-- DRAFT SHARES POLICIES
CREATE POLICY "Draft owners can manage shares" ON public.draft_shares
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.draft_sessions
      WHERE draft_sessions.id = draft_shares.draft_session_id
      AND draft_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can read active shares" ON public.draft_shares
  FOR SELECT USING (is_active = TRUE);

-- PLAYER POOLS POLICIES
CREATE POLICY "Users can manage own player pools" ON public.player_pools
  FOR ALL USING (auth.uid() = user_id);

-- CUSTOM POOLS POLICIES
CREATE POLICY "Users can manage own custom pools" ON public.custom_pools
  FOR ALL USING (auth.uid() = user_id);

-- CUSTOM TEMPLATES POLICIES
CREATE POLICY "Users can manage own templates" ON public.custom_templates
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- ADD MISSING COLUMNS TO CUSTOM_TEMPLATES
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public'
                 AND table_name = 'custom_templates'
                 AND column_name = 'allow_duplicates') THEN
    ALTER TABLE public.custom_templates ADD COLUMN allow_duplicates BOOLEAN DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public'
                 AND table_name = 'custom_templates'
                 AND column_name = 'sort_order') THEN
    ALTER TABLE public.custom_templates ADD COLUMN sort_order INTEGER DEFAULT 0;
  END IF;
END $$;
