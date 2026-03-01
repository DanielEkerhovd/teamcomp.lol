-- Rework stale session cleanup:
-- 1) Auto-complete sessions inactive for 3+ hours (unchanged)
-- 2) Clean up pending games + sync counts for completed/cancelled sessions (unchanged)
-- 3) CHANGED: Only delete sessions that have ZERO completed games.
--    Sessions with real draft data are preserved and only removed
--    when all users explicitly hide/leave (trigger-based cleanup).

CREATE OR REPLACE FUNCTION public.cleanup_stale_live_draft_sessions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stale_count INTEGER;
  v_empty_count INTEGER;
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

  -- 2) For completed/cancelled sessions, delete pending games and sync counts.
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

  -- 3) Delete completed/cancelled sessions that have NO completed games.
  --    These are empty lobbies or abandoned sessions with no real draft data.
  --    Sessions WITH completed games are preserved for history and only
  --    cleaned up when all users explicitly hide them (trigger-based).
  DELETE FROM live_draft_sessions
  WHERE status IN ('completed', 'cancelled')
    AND NOT EXISTS (
      SELECT 1 FROM live_draft_games g
      WHERE g.session_id = live_draft_sessions.id
        AND g.status = 'completed'
    );

  GET DIAGNOSTICS v_empty_count = ROW_COUNT;

  RETURN v_stale_count + v_empty_count;
END;
$$;
