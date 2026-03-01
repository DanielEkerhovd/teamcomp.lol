-- Add ban columns to my_teams
ALTER TABLE my_teams ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE my_teams ADD COLUMN IF NOT EXISTS ban_reason TEXT DEFAULT NULL;

-- Update admin_search_teams to include ban fields
DROP FUNCTION IF EXISTS public.admin_search_teams(TEXT);
CREATE OR REPLACE FUNCTION public.admin_search_teams(search_query TEXT)
RETURNS TABLE (
  id                    TEXT,
  name                  TEXT,
  owner_id              UUID,
  owner_display_name    TEXT,
  owner_avatar_url      TEXT,
  has_team_plan         BOOLEAN,
  team_plan_status      TEXT,
  team_max_enemy_teams  INTEGER,
  member_count          BIGINT,
  banned_at             TIMESTAMPTZ,
  ban_reason            TEXT,
  created_at            TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_tier TEXT;
BEGIN
  SELECT p.tier INTO caller_tier FROM profiles p WHERE p.id = auth.uid();
  IF caller_tier IS DISTINCT FROM 'developer' THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  SELECT
    t.id,
    t.name,
    t.user_id        AS owner_id,
    p.display_name   AS owner_display_name,
    p.avatar_url     AS owner_avatar_url,
    t.has_team_plan,
    t.team_plan_status,
    t.team_max_enemy_teams,
    (SELECT COUNT(*) FROM team_members tm WHERE tm.team_id = t.id) AS member_count,
    t.banned_at,
    t.ban_reason,
    t.created_at
  FROM my_teams t
  JOIN profiles p ON p.id = t.user_id
  WHERE t.name ILIKE '%' || search_query || '%'
     OR t.id = search_query
  ORDER BY t.created_at DESC
  LIMIT 50;
END;
$$;

-- Admin rename team
CREATE OR REPLACE FUNCTION public.admin_rename_team(
  target_team_id TEXT,
  new_name       TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_tier TEXT;
  v_team      RECORD;
BEGIN
  SELECT p.tier INTO caller_tier FROM profiles p WHERE p.id = auth.uid();
  IF caller_tier IS DISTINCT FROM 'developer' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Forbidden');
  END IF;

  SELECT id INTO v_team FROM my_teams WHERE id = target_team_id;
  IF v_team.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Team not found');
  END IF;

  IF TRIM(new_name) = '' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Name cannot be empty');
  END IF;

  UPDATE my_teams
  SET name = TRIM(new_name),
      updated_at = NOW()
  WHERE id = target_team_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Admin delete team (hard delete)
CREATE OR REPLACE FUNCTION public.admin_delete_team(
  target_team_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_tier TEXT;
  v_team      RECORD;
BEGIN
  SELECT p.tier INTO caller_tier FROM profiles p WHERE p.id = auth.uid();
  IF caller_tier IS DISTINCT FROM 'developer' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Forbidden');
  END IF;

  SELECT id, name INTO v_team FROM my_teams WHERE id = target_team_id;
  IF v_team.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Team not found');
  END IF;

  -- Delete related data first (in case no CASCADE)
  DELETE FROM team_invites WHERE team_id = target_team_id;
  DELETE FROM team_members WHERE team_id = target_team_id;
  DELETE FROM players WHERE team_id = target_team_id;

  -- Delete enemy teams and their players for this team
  DELETE FROM enemy_players WHERE team_id IN (
    SELECT id FROM enemy_teams WHERE team_id = target_team_id
  );
  DELETE FROM enemy_teams WHERE team_id = target_team_id;

  -- Unlink draft sessions from this team
  UPDATE draft_sessions SET my_team_id = NULL WHERE my_team_id = target_team_id;

  -- Delete the team itself
  DELETE FROM my_teams WHERE id = target_team_id;

  RETURN jsonb_build_object('success', true, 'message', 'Team deleted: ' || v_team.name);
END;
$$;

-- Admin ban team
CREATE OR REPLACE FUNCTION public.admin_ban_team(
  target_team_id TEXT,
  p_reason       TEXT DEFAULT 'Banned by administrator'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_tier TEXT;
  v_team      RECORD;
BEGIN
  SELECT p.tier INTO caller_tier FROM profiles p WHERE p.id = auth.uid();
  IF caller_tier IS DISTINCT FROM 'developer' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Forbidden');
  END IF;

  SELECT id, banned_at INTO v_team FROM my_teams WHERE id = target_team_id;
  IF v_team.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Team not found');
  END IF;

  IF v_team.banned_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Team is already banned');
  END IF;

  UPDATE my_teams
  SET banned_at  = NOW(),
      ban_reason = COALESCE(NULLIF(TRIM(p_reason), ''), 'Banned by administrator'),
      updated_at = NOW()
  WHERE id = target_team_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Admin unban team
CREATE OR REPLACE FUNCTION public.admin_unban_team(
  target_team_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_tier TEXT;
  v_team      RECORD;
BEGIN
  SELECT p.tier INTO caller_tier FROM profiles p WHERE p.id = auth.uid();
  IF caller_tier IS DISTINCT FROM 'developer' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Forbidden');
  END IF;

  SELECT id, banned_at INTO v_team FROM my_teams WHERE id = target_team_id;
  IF v_team.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Team not found');
  END IF;

  IF v_team.banned_at IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Team is not banned');
  END IF;

  UPDATE my_teams
  SET banned_at  = NULL,
      ban_reason = NULL,
      updated_at = NOW()
  WHERE id = target_team_id;

  RETURN jsonb_build_object('success', true);
END;
$$;
