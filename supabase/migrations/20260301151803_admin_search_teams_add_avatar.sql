-- Add owner_avatar_url to admin_search_teams
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
    t.created_at
  FROM my_teams t
  JOIN profiles p ON p.id = t.user_id
  WHERE t.name ILIKE '%' || search_query || '%'
     OR t.id = search_query
  ORDER BY t.created_at DESC
  LIMIT 50;
END;
$$;
