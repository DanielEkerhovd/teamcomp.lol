-- Repair: re-apply side picking functions that were missed in previous migration

CREATE OR REPLACE FUNCTION reset_ready_on_game_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    UPDATE live_draft_sessions
    SET team1_ready = FALSE,
        team2_ready = FALSE,
        team1_side = NULL,
        team2_side = NULL
    WHERE id = NEW.session_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION clear_live_draft_sides(
  p_session_id UUID,
  p_team TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_session RECORD;
  v_is_captain BOOLEAN;
BEGIN
  v_user_id := auth.uid();

  SELECT * INTO v_session FROM live_draft_sessions WHERE id = p_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  IF v_user_id IS NOT NULL THEN
    v_is_captain := (v_session.team1_captain_id = v_user_id)
                 OR (v_session.team2_captain_id = v_user_id);
  ELSIF p_team IS NOT NULL THEN
    v_is_captain := TRUE;
  ELSE
    RAISE EXCEPTION 'Team parameter required for anonymous users';
  END IF;

  IF NOT v_is_captain THEN
    RAISE EXCEPTION 'Only captains can clear side selections';
  END IF;

  UPDATE live_draft_sessions
  SET team1_side = NULL,
      team2_side = NULL,
      team1_ready = FALSE,
      team2_ready = FALSE
  WHERE id = p_session_id;

  RETURN json_build_object(
    'success', true,
    'session_id', p_session_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION clear_live_draft_sides TO anon, authenticated;
