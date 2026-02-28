-- Automatically sync current_game_number on the session whenever a game starts drafting.
-- This keeps the session-level counter accurate for list pages / cards.

CREATE OR REPLACE FUNCTION sync_current_game_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'drafting' AND (OLD.status IS DISTINCT FROM 'drafting') THEN
    UPDATE live_draft_sessions
    SET current_game_number = NEW.game_number
    WHERE id = NEW.session_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_current_game_number
  AFTER UPDATE ON live_draft_games
  FOR EACH ROW
  EXECUTE FUNCTION sync_current_game_number();

-- Back-fill existing sessions: set current_game_number to the highest
-- game that is drafting or completed.
UPDATE live_draft_sessions s
SET current_game_number = sub.max_game
FROM (
  SELECT session_id, MAX(game_number) AS max_game
  FROM live_draft_games
  WHERE status IN ('drafting', 'completed')
  GROUP BY session_id
) sub
WHERE s.id = sub.session_id
  AND s.current_game_number < sub.max_game;
