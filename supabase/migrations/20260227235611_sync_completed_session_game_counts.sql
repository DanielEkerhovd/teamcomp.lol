-- Fix completed/cancelled sessions: sync planned_games and current_game_number
-- to the actual number of completed games, and delete orphaned pending games.

-- 1) Delete pending (never-started) games from completed/cancelled sessions.
DELETE FROM live_draft_games
WHERE status = 'pending'
  AND session_id IN (
    SELECT id FROM live_draft_sessions
    WHERE status IN ('completed', 'cancelled')
  );

-- 2) Update planned_games and current_game_number to the actual completed count.
UPDATE live_draft_sessions s
SET planned_games = sub.completed_count,
    current_game_number = sub.completed_count
FROM (
  SELECT session_id, COUNT(*) AS completed_count
  FROM live_draft_games
  WHERE status = 'completed'
  GROUP BY session_id
) sub
WHERE s.id = sub.session_id
  AND s.status IN ('completed', 'cancelled')
  AND (s.planned_games <> sub.completed_count
       OR s.current_game_number <> sub.completed_count);
