-- Platform Stats: aggregated platform usage statistics for admin dashboard.

CREATE OR REPLACE FUNCTION public.get_platform_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_tier TEXT;
  v_result    JSONB;
BEGIN
  -- Only developers may call this
  SELECT p.tier INTO caller_tier FROM profiles p WHERE p.id = auth.uid();
  IF caller_tier IS DISTINCT FROM 'developer' THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT jsonb_build_object(
    -- Users
    'total_users', (SELECT COUNT(*) FROM profiles),
    'users_by_tier', (
      SELECT COALESCE(jsonb_object_agg(tier, cnt), '{}'::jsonb)
      FROM (SELECT tier, COUNT(*) AS cnt FROM profiles GROUP BY tier) t
    ),
    'new_users_week', (
      SELECT COUNT(*) FROM profiles WHERE created_at >= NOW() - INTERVAL '7 days'
    ),
    'new_users_month', (
      SELECT COUNT(*) FROM profiles WHERE created_at >= NOW() - INTERVAL '30 days'
    ),
    'banned_users', (
      SELECT COUNT(*) FROM profiles WHERE banned_at IS NOT NULL
    ),

    -- Teams
    'total_teams', (SELECT COUNT(*) FROM my_teams),
    'teams_with_plan', (
      SELECT COUNT(*) FROM my_teams WHERE has_team_plan = TRUE
    ),
    'total_team_members', (SELECT COUNT(*) FROM team_members),
    'banned_teams', (
      SELECT COUNT(*) FROM my_teams WHERE banned_at IS NOT NULL
    ),

    -- Draft Sessions
    'total_drafts', (SELECT COUNT(*) FROM draft_sessions),
    'active_drafts', (
      SELECT COUNT(*) FROM draft_sessions WHERE archived_at IS NULL
    ),
    'archived_drafts', (
      SELECT COUNT(*) FROM draft_sessions WHERE archived_at IS NOT NULL
    ),
    'favorite_drafts', (
      SELECT COUNT(*) FROM draft_sessions WHERE is_favorite = TRUE
    ),

    -- Live Drafts
    'total_live_drafts', (SELECT COUNT(*) FROM live_draft_sessions),
    'live_drafts_by_status', (
      SELECT COALESCE(jsonb_object_agg(status, cnt), '{}'::jsonb)
      FROM (SELECT status, COUNT(*) AS cnt FROM live_draft_sessions GROUP BY status) t
    ),
    'live_draft_modes', (
      SELECT COALESCE(jsonb_object_agg(draft_mode, cnt), '{}'::jsonb)
      FROM (SELECT draft_mode, COUNT(*) AS cnt FROM live_draft_sessions GROUP BY draft_mode) t
    ),

    -- Live Draft Games
    'total_games', (SELECT COUNT(*) FROM live_draft_games),
    'completed_games', (
      SELECT COUNT(*) FROM live_draft_games WHERE status = 'completed'
    ),

    -- Draft creators: logged-in users vs anonymous
    'drafts_by_users', (
      SELECT COUNT(*) FROM live_draft_sessions WHERE created_by IS NOT NULL
    ),
    'drafts_by_anon', (
      SELECT COUNT(*) FROM live_draft_sessions WHERE created_by IS NULL
    ),

    -- Game format distribution (Bo1, Bo3, Bo5, etc.)
    'game_formats', (
      SELECT COALESCE(jsonb_object_agg(label, cnt), '{}'::jsonb)
      FROM (
        SELECT 'Bo' || planned_games AS label, COUNT(*) AS cnt
        FROM live_draft_sessions
        GROUP BY planned_games
        ORDER BY planned_games
      ) t
    ),

    -- Social
    'total_friendships', (
      SELECT COUNT(*) FROM friendships WHERE status = 'accepted'
    ),
    'total_shares', (SELECT COUNT(*) FROM draft_shares),
    'total_share_views', (
      SELECT COALESCE(SUM(view_count), 0) FROM draft_shares
    ),

    -- Subscriptions
    'active_subscriptions', (
      SELECT COUNT(*) FROM subscriptions WHERE status = 'active'
    ),
    'subscriptions_by_tier', (
      SELECT COALESCE(jsonb_object_agg(tier, cnt), '{}'::jsonb)
      FROM (SELECT tier, COUNT(*) AS cnt FROM subscriptions WHERE status = 'active' GROUP BY tier) t
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_platform_stats() TO authenticated;
