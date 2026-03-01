-- Server-side enforcement: prevent modifications to banned teams
-- This ensures that even if the UI is bypassed, banned teams remain locked.

-- 1. Trigger function for child tables (players, enemy_teams, enemy_players,
--    draft_sessions, team_invites, team_members)
CREATE OR REPLACE FUNCTION public.enforce_team_ban()
RETURNS TRIGGER AS $$
DECLARE
  v_banned_at TIMESTAMPTZ;
  v_team_id   TEXT;
BEGIN
  -- Determine which my_teams row to check based on the triggering table
  IF TG_TABLE_NAME = 'draft_sessions' THEN
    v_team_id := NEW.my_team_id;
    IF v_team_id IS NULL THEN
      RETURN NEW; -- personal draft, no team ban to check
    END IF;
  ELSIF TG_TABLE_NAME = 'enemy_players' THEN
    -- enemy_players.team_id -> enemy_teams.id -> enemy_teams.team_id -> my_teams.id
    SELECT mt.banned_at INTO v_banned_at
    FROM enemy_teams et
    JOIN my_teams mt ON mt.id = et.team_id
    WHERE et.id = NEW.team_id;

    IF v_banned_at IS NOT NULL THEN
      RAISE EXCEPTION 'This team is currently banned and cannot be modified.';
    END IF;
    RETURN NEW;
  ELSE
    -- players, enemy_teams, team_invites, team_members all have team_id -> my_teams.id
    v_team_id := NEW.team_id;
  END IF;

  SELECT banned_at INTO v_banned_at FROM my_teams WHERE id = v_team_id;

  IF v_banned_at IS NOT NULL THEN
    RAISE EXCEPTION 'This team is currently banned and cannot be modified.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Trigger function for my_teams itself
--    Blocks updates to non-ban columns when the team is banned.
--    Admin functions that only touch banned_at/ban_reason/ban_expires_at pass through.
CREATE OR REPLACE FUNCTION public.enforce_own_team_ban()
RETURNS TRIGGER AS $$
BEGIN
  -- Only enforce if the team was already banned before this update
  IF OLD.banned_at IS NOT NULL THEN
    -- Allow updates that only modify ban-related columns (+ updated_at)
    -- Block if any "content" column changed
    IF ROW(NEW.name, NEW.notes, NEW.has_team_plan, NEW.team_plan_status,
           NEW.team_max_enemy_teams, NEW.perm_drafts, NEW.perm_enemy_teams, NEW.perm_players)
       IS DISTINCT FROM
       ROW(OLD.name, OLD.notes, OLD.has_team_plan, OLD.team_plan_status,
           OLD.team_max_enemy_teams, OLD.perm_drafts, OLD.perm_enemy_teams, OLD.perm_players) THEN
      RAISE EXCEPTION 'This team is currently banned and cannot be modified.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Attach triggers to child tables

-- Players: block adding or modifying players on banned teams
CREATE TRIGGER enforce_team_ban_players
  BEFORE INSERT OR UPDATE ON public.players
  FOR EACH ROW EXECUTE FUNCTION public.enforce_team_ban();

-- Enemy teams: block creating or modifying enemy teams for banned teams
CREATE TRIGGER enforce_team_ban_enemy_teams
  BEFORE INSERT OR UPDATE ON public.enemy_teams
  FOR EACH ROW EXECUTE FUNCTION public.enforce_team_ban();

-- Enemy players: block adding or modifying enemy players for banned teams
CREATE TRIGGER enforce_team_ban_enemy_players
  BEFORE INSERT OR UPDATE ON public.enemy_players
  FOR EACH ROW EXECUTE FUNCTION public.enforce_team_ban();

-- Draft sessions: block creating new team drafts for banned teams
CREATE TRIGGER enforce_team_ban_draft_sessions
  BEFORE INSERT ON public.draft_sessions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_team_ban();

-- Team invites: block sending invites for banned teams
CREATE TRIGGER enforce_team_ban_team_invites
  BEFORE INSERT ON public.team_invites
  FOR EACH ROW EXECUTE FUNCTION public.enforce_team_ban();

-- Team members: block adding new members to banned teams
CREATE TRIGGER enforce_team_ban_team_members
  BEFORE INSERT ON public.team_members
  FOR EACH ROW EXECUTE FUNCTION public.enforce_team_ban();

-- 4. My teams: block non-ban-column updates when team is banned
CREATE TRIGGER enforce_own_team_ban
  BEFORE UPDATE ON public.my_teams
  FOR EACH ROW EXECUTE FUNCTION public.enforce_own_team_ban();
