-- Fix enforce_own_team_ban: replace dropped team_content_permission with granular perm columns
-- The column was dropped in granular_content_permissions migration but this trigger still referenced it.

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
