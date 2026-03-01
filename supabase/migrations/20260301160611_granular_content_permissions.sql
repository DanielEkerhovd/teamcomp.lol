-- Granular team content permissions
-- Replaces the single team_content_permission with per-resource permissions
-- and adds per-member grant overrides.

-- ============================================
-- 1. ADD GRANULAR PERMISSION COLUMNS TO my_teams
-- ============================================

ALTER TABLE public.my_teams
  ADD COLUMN IF NOT EXISTS perm_drafts TEXT NOT NULL DEFAULT 'admins',
  ADD COLUMN IF NOT EXISTS perm_enemy_teams TEXT NOT NULL DEFAULT 'admins',
  ADD COLUMN IF NOT EXISTS perm_players TEXT NOT NULL DEFAULT 'admins';

-- Migrate existing team_content_permission values
UPDATE public.my_teams
SET perm_drafts = team_content_permission,
    perm_enemy_teams = team_content_permission,
    perm_players = team_content_permission;

-- Drop old RLS policies that depend on team_content_permission BEFORE dropping the column
DROP POLICY IF EXISTS "Team content creators can insert team enemy teams" ON public.enemy_teams;
DROP POLICY IF EXISTS "Team content creators can update team enemy teams" ON public.enemy_teams;
DROP POLICY IF EXISTS "Team content creators can delete team enemy teams" ON public.enemy_teams;
DROP POLICY IF EXISTS "Team content creators can insert team drafts" ON public.draft_sessions;

-- Drop old column
ALTER TABLE public.my_teams DROP COLUMN IF EXISTS team_content_permission;

-- ============================================
-- 2. ADD PER-MEMBER GRANT OVERRIDES TO team_members
-- ============================================

ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS grant_drafts BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS grant_enemy_teams BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS grant_players BOOLEAN NOT NULL DEFAULT FALSE;

-- ============================================
-- 3. HELPER FUNCTION: check_team_content_access
-- ============================================

CREATE OR REPLACE FUNCTION public.check_team_content_access(
  p_team_id TEXT,
  p_user_id UUID,
  p_resource TEXT  -- 'drafts', 'enemy_teams', or 'players'
) RETURNS BOOLEAN AS $$
DECLARE
  team_record RECORD;
  member_record RECORD;
  perm_val TEXT;
BEGIN
  -- Get team
  SELECT * INTO team_record FROM public.my_teams WHERE id = p_team_id;
  IF team_record IS NULL THEN RETURN FALSE; END IF;

  -- Must have active team plan
  IF team_record.has_team_plan IS NOT TRUE THEN RETURN FALSE; END IF;

  -- Owner always has access
  IF team_record.user_id = p_user_id THEN RETURN TRUE; END IF;

  -- Get the team-level permission value for this resource
  IF p_resource = 'drafts' THEN perm_val := team_record.perm_drafts;
  ELSIF p_resource = 'enemy_teams' THEN perm_val := team_record.perm_enemy_teams;
  ELSIF p_resource = 'players' THEN perm_val := team_record.perm_players;
  ELSE RETURN FALSE;
  END IF;

  -- Get member record
  SELECT * INTO member_record FROM public.team_members
  WHERE team_id = p_team_id AND user_id = p_user_id;
  IF member_record IS NULL THEN RETURN FALSE; END IF;

  -- Check per-member explicit grant override
  IF p_resource = 'drafts' AND member_record.grant_drafts THEN RETURN TRUE; END IF;
  IF p_resource = 'enemy_teams' AND member_record.grant_enemy_teams THEN RETURN TRUE; END IF;
  IF p_resource = 'players' AND member_record.grant_players THEN RETURN TRUE; END IF;

  -- Check team-level general setting against member role
  IF perm_val = 'all' THEN RETURN TRUE; END IF;
  IF perm_val = 'players' AND member_record.role IN ('admin', 'player') THEN RETURN TRUE; END IF;
  IF perm_val = 'admins' AND member_record.role = 'admin' THEN RETURN TRUE; END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.check_team_content_access(TEXT, UUID, TEXT) TO authenticated;

-- ============================================
-- 4. DROP & RECREATE RLS POLICIES FOR ENEMY TEAMS
-- ============================================

DROP POLICY IF EXISTS "Team content creators can insert team enemy teams" ON public.enemy_teams;
DROP POLICY IF EXISTS "Team content creators can update team enemy teams" ON public.enemy_teams;
DROP POLICY IF EXISTS "Team content creators can delete team enemy teams" ON public.enemy_teams;

CREATE POLICY "Team content creators can insert team enemy teams"
  ON public.enemy_teams
  FOR INSERT
  WITH CHECK (
    team_id IS NULL  -- personal enemy teams use existing policies
    OR (
      team_id IS NOT NULL
      AND public.check_team_content_access(team_id, auth.uid(), 'enemy_teams')
    )
  );

CREATE POLICY "Team content creators can update team enemy teams"
  ON public.enemy_teams
  FOR UPDATE
  USING (
    team_id IS NOT NULL
    AND public.check_team_content_access(team_id, auth.uid(), 'enemy_teams')
  );

CREATE POLICY "Team content creators can delete team enemy teams"
  ON public.enemy_teams
  FOR DELETE
  USING (
    team_id IS NOT NULL
    AND public.check_team_content_access(team_id, auth.uid(), 'enemy_teams')
  );

-- ============================================
-- 5. DROP & RECREATE RLS POLICY FOR DRAFT SESSIONS
-- ============================================

DROP POLICY IF EXISTS "Team content creators can insert team drafts" ON public.draft_sessions;

CREATE POLICY "Team content creators can insert team drafts"
  ON public.draft_sessions
  FOR INSERT
  WITH CHECK (
    my_team_id IS NULL  -- personal drafts use existing policies
    OR (
      my_team_id IS NOT NULL
      AND public.check_team_content_access(my_team_id, auth.uid(), 'drafts')
    )
  );

-- ============================================
-- 6. UPDATE get_team_memberships() TO RETURN GRANULAR PERMISSIONS
-- ============================================

CREATE OR REPLACE FUNCTION public.get_team_memberships()
RETURNS JSON AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN '[]'::json;
  END IF;

  RETURN COALESCE((
    SELECT json_agg(json_build_object(
      'membershipId', tm.id,
      'teamId', tm.team_id,
      'teamName', mt.name,
      'role', tm.role,
      'canEditGroups', tm.can_edit_groups,
      'playerSlotId', tm.player_slot_id,
      'joinedAt', tm.joined_at,
      'ownerName', p.display_name,
      'ownerAvatar', p.avatar_url,
      'hasTeamPlan', mt.has_team_plan,
      'teamPlanStatus', mt.team_plan_status,
      'permDrafts', mt.perm_drafts,
      'permEnemyTeams', mt.perm_enemy_teams,
      'permPlayers', mt.perm_players,
      'grantDrafts', tm.grant_drafts,
      'grantEnemyTeams', tm.grant_enemy_teams,
      'grantPlayers', tm.grant_players,
      'bannedAt', mt.banned_at,
      'banReason', mt.ban_reason,
      'banExpiresAt', mt.ban_expires_at
    ) ORDER BY mt.name)
    FROM public.team_members tm
    JOIN public.my_teams mt ON mt.id = tm.team_id
    JOIN public.profiles p ON p.id = mt.user_id
    WHERE tm.user_id = auth.uid()
    AND tm.role != 'owner'
  ), '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
