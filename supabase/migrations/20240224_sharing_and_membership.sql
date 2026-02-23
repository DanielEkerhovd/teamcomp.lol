-- Migration: Sharing and Team Membership
-- Adds support for:
-- 1. Public share links for draft sessions
-- 2. Team membership with role-based permissions
-- 3. Invite system for adding team members

-- ============================================
-- EXTENSIONS
-- ============================================

-- Enable pgcrypto for gen_random_bytes (used for token generation)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================
-- NEW TABLES
-- ============================================

-- Team members (tracks who belongs to which team)
CREATE TABLE public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.my_teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'player', 'viewer')) DEFAULT 'player',
  player_slot_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
  invited_by UUID REFERENCES public.profiles(id),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

CREATE INDEX idx_team_members_team ON public.team_members(team_id);
CREATE INDEX idx_team_members_user ON public.team_members(user_id);

-- Team invites (pending invitations)
CREATE TABLE public.team_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.my_teams(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(24), 'hex'),
  invited_email TEXT,
  role TEXT NOT NULL CHECK (role IN ('player', 'viewer')) DEFAULT 'player',
  player_slot_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_team_invites_team ON public.team_invites(team_id);
CREATE INDEX idx_team_invites_token ON public.team_invites(token);

-- Draft shares (public share tokens for draft sessions)
CREATE TABLE public.draft_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_session_id UUID NOT NULL REFERENCES public.draft_sessions(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(24), 'hex'),
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  is_active BOOLEAN DEFAULT TRUE,
  view_count INTEGER DEFAULT 0,
  last_viewed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_draft_shares_draft ON public.draft_shares(draft_session_id);
CREATE INDEX idx_draft_shares_token ON public.draft_shares(token);

-- ============================================
-- SCHEMA MODIFICATIONS
-- ============================================

-- Add my_team_id to draft_sessions for team membership access
ALTER TABLE public.draft_sessions
ADD COLUMN IF NOT EXISTS my_team_id UUID REFERENCES public.my_teams(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_draft_sessions_my_team ON public.draft_sessions(my_team_id);

-- ============================================
-- ENABLE RLS ON NEW TABLES
-- ============================================

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draft_shares ENABLE ROW LEVEL SECURITY;

-- ============================================
-- DROP OLD POLICIES (to replace with new ones)
-- ============================================

DROP POLICY IF EXISTS "Users can manage own teams" ON public.my_teams;
DROP POLICY IF EXISTS "Users can manage players in own teams" ON public.players;
DROP POLICY IF EXISTS "Users can manage own draft sessions" ON public.draft_sessions;
DROP POLICY IF EXISTS "Users can manage own enemy teams" ON public.enemy_teams;
DROP POLICY IF EXISTS "Users can manage enemy players in own teams" ON public.enemy_players;

-- ============================================
-- NEW RLS POLICIES
-- ============================================

-- MY_TEAMS POLICIES
-- Owners can do everything
CREATE POLICY "Owners can manage own teams" ON public.my_teams
  FOR ALL USING (auth.uid() = user_id);

-- Team members can view teams they belong to
CREATE POLICY "Members can view teams" ON public.my_teams
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_members.team_id = my_teams.id
      AND team_members.user_id = auth.uid()
    )
  );

-- PLAYERS POLICIES
-- Owners can manage all players in their teams
CREATE POLICY "Owners can manage players in own teams" ON public.players
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.my_teams
      WHERE my_teams.id = players.team_id
      AND my_teams.user_id = auth.uid()
    )
  );

-- Team members can view all players
CREATE POLICY "Members can view players" ON public.players
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.team_members
      INNER JOIN public.my_teams ON my_teams.id = team_members.team_id
      WHERE my_teams.id = players.team_id
      AND team_members.user_id = auth.uid()
    )
  );

-- Players can update their own assigned slot (champion pool only)
CREATE POLICY "Players can update own slot" ON public.players
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_members.player_slot_id = players.id
      AND team_members.user_id = auth.uid()
      AND team_members.role = 'player'
    )
  );

-- DRAFT SESSIONS POLICIES
-- Owners can manage their own draft sessions
CREATE POLICY "Owners can manage own draft sessions" ON public.draft_sessions
  FOR ALL USING (auth.uid() = user_id);

-- Team members can view draft sessions for their team
CREATE POLICY "Members can view team draft sessions" ON public.draft_sessions
  FOR SELECT USING (
    my_team_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_members.team_id = draft_sessions.my_team_id
      AND team_members.user_id = auth.uid()
    )
  );

-- ENEMY TEAMS POLICIES
-- Owners can manage their own enemy teams
CREATE POLICY "Owners can manage own enemy teams" ON public.enemy_teams
  FOR ALL USING (auth.uid() = user_id);

-- Team members can view enemy teams linked to drafts they have access to
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
-- Owners can manage enemy players in their teams
CREATE POLICY "Owners can manage enemy players" ON public.enemy_players
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.enemy_teams
      WHERE enemy_teams.id = enemy_players.team_id
      AND enemy_teams.user_id = auth.uid()
    )
  );

-- Team members can view enemy players via drafts
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

-- TEAM MEMBERS POLICIES
-- Owners can manage team members
CREATE POLICY "Owners can manage team members" ON public.team_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.my_teams
      WHERE my_teams.id = team_members.team_id
      AND my_teams.user_id = auth.uid()
    )
  );

-- Members can view their own memberships
CREATE POLICY "Users can view own memberships" ON public.team_members
  FOR SELECT USING (auth.uid() = user_id);

-- TEAM INVITES POLICIES
-- Owners can manage invites for their teams
CREATE POLICY "Owners can manage invites" ON public.team_invites
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.my_teams
      WHERE my_teams.id = team_invites.team_id
      AND my_teams.user_id = auth.uid()
    )
  );

-- Anyone can read invite by token (for accepting)
CREATE POLICY "Anyone can read invites" ON public.team_invites
  FOR SELECT USING (TRUE);

-- DRAFT SHARES POLICIES
-- Draft owners can manage shares
CREATE POLICY "Draft owners can manage shares" ON public.draft_shares
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.draft_sessions
      WHERE draft_sessions.id = draft_shares.draft_session_id
      AND draft_sessions.user_id = auth.uid()
    )
  );

-- Anyone can read active shares (needed for public access)
CREATE POLICY "Anyone can read active shares" ON public.draft_shares
  FOR SELECT USING (is_active = TRUE);

-- ============================================
-- RPC FUNCTIONS
-- ============================================

-- Function to get shared draft data (for public access, bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_shared_draft(share_token TEXT)
RETURNS JSON AS $$
DECLARE
  result JSON;
  share_record RECORD;
BEGIN
  -- Find the share
  SELECT ds.*, dr.id as draft_id
  INTO share_record
  FROM public.draft_shares ds
  INNER JOIN public.draft_sessions dr ON dr.id = ds.draft_session_id
  WHERE ds.token = share_token
  AND ds.is_active = TRUE
  AND (ds.expires_at IS NULL OR ds.expires_at > NOW());

  IF share_record IS NULL THEN
    RETURN NULL;
  END IF;

  -- Update view count
  UPDATE public.draft_shares
  SET view_count = view_count + 1, last_viewed_at = NOW()
  WHERE id = share_record.id;

  -- Build result with all necessary data
  SELECT json_build_object(
    'draft', row_to_json(d),
    'enemyTeam', CASE WHEN d.enemy_team_id IS NOT NULL THEN (
      SELECT json_build_object(
        'team', row_to_json(et),
        'players', COALESCE((
          SELECT json_agg(row_to_json(ep) ORDER BY ep.sort_order)
          FROM public.enemy_players ep
          WHERE ep.team_id = et.id
        ), '[]'::json)
      )
      FROM public.enemy_teams et
      WHERE et.id = d.enemy_team_id
    ) ELSE NULL END,
    'myTeam', CASE WHEN d.my_team_id IS NOT NULL THEN (
      SELECT json_build_object(
        'team', row_to_json(mt),
        'players', COALESCE((
          SELECT json_agg(row_to_json(p) ORDER BY p.sort_order)
          FROM public.players p
          WHERE p.team_id = mt.id
        ), '[]'::json)
      )
      FROM public.my_teams mt
      WHERE mt.id = d.my_team_id
    ) ELSE NULL END,
    'shareInfo', json_build_object(
      'viewCount', share_record.view_count + 1,
      'createdAt', share_record.created_at
    )
  )
  INTO result
  FROM public.draft_sessions d
  WHERE d.id = share_record.draft_id;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get invite details (for showing invite page)
CREATE OR REPLACE FUNCTION public.get_invite_details(invite_token TEXT)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'id', ti.id,
    'teamName', mt.name,
    'role', ti.role,
    'playerSlot', CASE WHEN ti.player_slot_id IS NOT NULL THEN (
      SELECT json_build_object(
        'id', p.id,
        'summonerName', p.summoner_name,
        'role', p.role
      )
      FROM public.players p
      WHERE p.id = ti.player_slot_id
    ) ELSE NULL END,
    'expiresAt', ti.expires_at,
    'isExpired', ti.expires_at < NOW(),
    'isAccepted', ti.accepted_at IS NOT NULL
  )
  INTO result
  FROM public.team_invites ti
  INNER JOIN public.my_teams mt ON mt.id = ti.team_id
  WHERE ti.token = invite_token;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to accept team invite
CREATE OR REPLACE FUNCTION public.accept_team_invite(invite_token TEXT)
RETURNS JSON AS $$
DECLARE
  invite_record RECORD;
  new_member_id UUID;
BEGIN
  -- Check if user is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be authenticated to accept invite';
  END IF;

  -- Find and validate invite
  SELECT * INTO invite_record
  FROM public.team_invites
  WHERE token = invite_token
  AND accepted_at IS NULL
  AND (expires_at IS NULL OR expires_at > NOW());

  IF invite_record IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired invite';
  END IF;

  -- Check if already a member
  IF EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = invite_record.team_id
    AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Already a member of this team';
  END IF;

  -- Create membership
  INSERT INTO public.team_members (team_id, user_id, role, player_slot_id, invited_by)
  VALUES (
    invite_record.team_id,
    auth.uid(),
    invite_record.role,
    invite_record.player_slot_id,
    invite_record.created_by
  )
  RETURNING id INTO new_member_id;

  -- Mark invite as accepted
  UPDATE public.team_invites
  SET accepted_at = NOW(), accepted_by = auth.uid()
  WHERE id = invite_record.id;

  RETURN json_build_object(
    'success', TRUE,
    'membershipId', new_member_id,
    'teamId', invite_record.team_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
