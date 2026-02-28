-- When a game completes, automatically reset both teams' ready flags on the session.
-- This ensures captains must re-ready for the next game instead of carrying over
-- stale ready state from the previous game.

CREATE OR REPLACE FUNCTION reset_ready_on_game_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only fire when status changes TO 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    UPDATE live_draft_sessions
    SET team1_ready = FALSE,
        team2_ready = FALSE
    WHERE id = NEW.session_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_reset_ready_on_game_complete
  AFTER UPDATE OF status ON live_draft_games
  FOR EACH ROW
  WHEN (NEW.status = 'completed')
  EXECUTE FUNCTION reset_ready_on_game_complete();
