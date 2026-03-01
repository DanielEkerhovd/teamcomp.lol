-- Admin team search: find teams by name or ID
CREATE OR REPLACE FUNCTION public.admin_search_teams(search_query TEXT)
RETURNS TABLE (
  id                    TEXT,
  name                  TEXT,
  owner_id              UUID,
  owner_display_name    TEXT,
  has_team_plan         BOOLEAN,
  team_plan_status      TEXT,
  team_max_enemy_teams  INTEGER,
  member_count          BIGINT,
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
    t.has_team_plan,
    t.team_plan_status,
    t.team_max_enemy_teams,
    (SELECT COUNT(*) FROM team_members tm WHERE tm.team_id = t.id) AS member_count,
    t.created_at
  FROM my_teams t
  JOIN profiles p ON p.id = t.user_id
  WHERE t.name ILIKE '%' || search_query || '%'
     OR t.id = search_query
  ORDER BY t.created_at DESC
  LIMIT 50;
END;
$$;

-- Admin toggle team plan on/off
CREATE OR REPLACE FUNCTION public.admin_set_team_plan(
  target_team_id TEXT,
  enable         BOOLEAN
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

  SELECT id, has_team_plan INTO v_team FROM my_teams WHERE id = target_team_id;
  IF v_team.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Team not found');
  END IF;

  IF enable THEN
    UPDATE my_teams
    SET has_team_plan        = TRUE,
        team_plan_status     = 'active',
        team_max_enemy_teams = 300,
        updated_at           = NOW()
    WHERE id = target_team_id;
  ELSE
    UPDATE my_teams
    SET has_team_plan        = FALSE,
        team_plan_status     = NULL,
        team_max_enemy_teams = 0,
        updated_at           = NOW()
    WHERE id = target_team_id;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;
