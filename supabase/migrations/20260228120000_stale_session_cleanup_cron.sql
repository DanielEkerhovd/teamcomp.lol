-- Auto-complete stale live draft sessions and clean up anonymous orphans.
-- Runs every hour via pg_cron.

CREATE OR REPLACE FUNCTION public.cleanup_stale_live_draft_sessions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stale_count INTEGER;
  v_orphan_count INTEGER;
BEGIN
  -- 1) Auto-complete sessions inactive for 3+ hours.
  --    Check both session.updated_at and game.updated_at because
  --    submit_draft_action only touches live_draft_games, not the session row.
  UPDATE live_draft_sessions
  SET status = 'completed',
      completed_at = NOW()
  WHERE status IN ('lobby', 'in_progress')
    AND updated_at < NOW() - INTERVAL '3 hours'
    AND NOT EXISTS (
      SELECT 1 FROM live_draft_games g
      WHERE g.session_id = live_draft_sessions.id
        AND g.updated_at >= NOW() - INTERVAL '3 hours'
    );

  GET DIAGNOSTICS v_stale_count = ROW_COUNT;

  -- 1b) For freshly completed sessions, delete pending games and sync game counts.
  DELETE FROM live_draft_games
  WHERE status = 'pending'
    AND session_id IN (
      SELECT id FROM live_draft_sessions WHERE status IN ('completed', 'cancelled')
    );

  UPDATE live_draft_sessions s
  SET planned_games = sub.cnt,
      current_game_number = sub.cnt
  FROM (
    SELECT session_id, COUNT(*) AS cnt
    FROM live_draft_games
    WHERE status = 'completed'
    GROUP BY session_id
  ) sub
  WHERE s.id = sub.session_id
    AND s.status IN ('completed', 'cancelled')
    AND (s.planned_games <> sub.cnt OR s.current_game_number <> sub.cnt);

  -- 2) Delete completed/cancelled sessions with no visible authenticated users.
  --    The trigger-based orphan cleanup only fires when a user_sessions row is
  --    updated/deleted, so it misses all-anonymous sessions (zero rows).
  DELETE FROM live_draft_sessions
  WHERE status IN ('completed', 'cancelled')
    AND NOT EXISTS (
      SELECT 1 FROM live_draft_user_sessions
      WHERE session_id = live_draft_sessions.id
        AND hidden_at IS NULL
    );

  GET DIAGNOSTICS v_orphan_count = ROW_COUNT;

  RETURN v_stale_count + v_orphan_count;
END;
$$;

-- Schedule hourly cleanup
SELECT cron.schedule(
  'cleanup-stale-live-draft-sessions',
  '0 * * * *',
  $$SELECT public.cleanup_stale_live_draft_sessions()$$
);
