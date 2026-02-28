-- Update clear_live_draft_sides to only clear the calling captain's side (not both)

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
  v_team TEXT;
BEGIN
  v_user_id := auth.uid();

  SELECT * INTO v_session FROM live_draft_sessions WHERE id = p_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  -- Determine which team the caller belongs to
  IF v_user_id IS NOT NULL THEN
    IF v_session.team1_captain_id = v_user_id THEN
      v_team := 'team1';
    ELSIF v_session.team2_captain_id = v_user_id THEN
      v_team := 'team2';
    ELSE
      RAISE EXCEPTION 'Only captains can clear side selections';
    END IF;
  ELSIF p_team IS NOT NULL THEN
    v_team := p_team;
  ELSE
    RAISE EXCEPTION 'Team parameter required for anonymous users';
  END IF;

  -- Only clear the calling captain's side and ready state
  IF v_team = 'team1' THEN
    UPDATE live_draft_sessions
    SET team1_side = NULL,
        team1_ready = FALSE
    WHERE id = p_session_id;
  ELSE
    UPDATE live_draft_sessions
    SET team2_side = NULL,
        team2_ready = FALSE
    WHERE id = p_session_id;
  END IF;

  RETURN json_build_object(
    'success', true,
    'session_id', p_session_id
  );
END;
$$;
