-- Add ban_expires_at column to my_teams for timed bans
ALTER TABLE my_teams ADD COLUMN IF NOT EXISTS ban_expires_at TIMESTAMPTZ DEFAULT NULL;

-- Update admin_search_teams to include ban_expires_at
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
  ban_expires_at        TIMESTAMPTZ,
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
    t.ban_expires_at,
    t.created_at
  FROM my_teams t
  JOIN profiles p ON p.id = t.user_id
  WHERE t.name ILIKE '%' || search_query || '%'
     OR t.id = search_query
  ORDER BY t.created_at DESC
  LIMIT 50;
END;
$$;

-- Update admin_delete_team to accept a message and notify the team owner
DROP FUNCTION IF EXISTS public.admin_delete_team(TEXT);
CREATE OR REPLACE FUNCTION public.admin_delete_team(
  target_team_id TEXT,
  p_message      TEXT DEFAULT 'Your team has been removed by an administrator.'
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

  SELECT id, name, user_id INTO v_team FROM my_teams WHERE id = target_team_id;
  IF v_team.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Team not found');
  END IF;

  -- Send notification to team owner
  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (
    v_team.user_id,
    'team_deleted',
    'Team Deleted: ' || v_team.name,
    COALESCE(NULLIF(TRIM(p_message), ''), 'Your team has been removed by an administrator.'),
    jsonb_build_object('action', 'admin_delete_team', 'team_name', v_team.name, 'moderator_id', auth.uid()::text)
  );

  -- Delete related data
  DELETE FROM team_invites WHERE team_id = target_team_id;
  DELETE FROM team_members WHERE team_id = target_team_id;
  DELETE FROM players WHERE team_id = target_team_id;

  DELETE FROM enemy_players WHERE team_id IN (
    SELECT id FROM enemy_teams WHERE team_id = target_team_id
  );
  DELETE FROM enemy_teams WHERE team_id = target_team_id;

  UPDATE draft_sessions SET my_team_id = NULL WHERE my_team_id = target_team_id;

  DELETE FROM my_teams WHERE id = target_team_id;

  RETURN jsonb_build_object('success', true, 'message', 'Team deleted: ' || v_team.name);
END;
$$;

-- Update admin_ban_team to support timed bans
DROP FUNCTION IF EXISTS public.admin_ban_team(TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.admin_ban_team(
  target_team_id  TEXT,
  p_reason        TEXT DEFAULT 'Banned by administrator',
  ban_hours       INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_tier    TEXT;
  v_team         RECORD;
  v_expires_at   TIMESTAMPTZ;
BEGIN
  SELECT p.tier INTO caller_tier FROM profiles p WHERE p.id = auth.uid();
  IF caller_tier IS DISTINCT FROM 'developer' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Forbidden');
  END IF;

  SELECT id, banned_at, user_id INTO v_team FROM my_teams WHERE id = target_team_id;
  IF v_team.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Team not found');
  END IF;

  IF v_team.banned_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Team is already banned');
  END IF;

  IF ban_hours IS NOT NULL AND ban_hours > 0 THEN
    v_expires_at := NOW() + (ban_hours || ' hours')::INTERVAL;
  ELSE
    v_expires_at := NULL;
  END IF;

  UPDATE my_teams
  SET banned_at      = NOW(),
      ban_reason     = COALESCE(NULLIF(TRIM(p_reason), ''), 'Banned by administrator'),
      ban_expires_at = v_expires_at,
      updated_at     = NOW()
  WHERE id = target_team_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Update admin_unban_team to also clear ban_expires_at
DROP FUNCTION IF EXISTS public.admin_unban_team(TEXT);
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
  SET banned_at      = NULL,
      ban_reason     = NULL,
      ban_expires_at = NULL,
      updated_at     = NOW()
  WHERE id = target_team_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Cron: auto-unban teams with expired bans (every 15 min)
CREATE OR REPLACE FUNCTION public.expire_team_bans()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE my_teams
  SET banned_at      = NULL,
      ban_reason     = NULL,
      ban_expires_at = NULL,
      updated_at     = NOW()
  WHERE ban_expires_at IS NOT NULL
    AND ban_expires_at < NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

SELECT cron.schedule(
  'expire-team-bans',
  '*/15 * * * *',
  $$SELECT public.expire_team_bans()$$
);
