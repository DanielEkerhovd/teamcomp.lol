-- RPC function for session creator to kick a captain from a team slot
-- This is needed when an anonymous user joins, then creates an account/logs in,
-- causing the session to become locked since identities no longer match.

CREATE OR REPLACE FUNCTION kick_live_draft_captain(
  p_session_id UUID,
  p_team TEXT -- 'team1' or 'team2'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_session RECORD;
  v_kicked_user_id UUID;
BEGIN
  v_user_id := auth.uid();

  -- Validate team parameter
  IF p_team NOT IN ('team1', 'team2') THEN
    RAISE EXCEPTION 'Invalid team. Must be team1 or team2';
  END IF;

  -- Get session
  SELECT * INTO v_session FROM live_draft_sessions WHERE id = p_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  -- Only the session creator can kick
  IF v_user_id IS NULL OR v_session.created_by IS NULL OR v_session.created_by != v_user_id THEN
    RAISE EXCEPTION 'Only the session creator can kick a captain';
  END IF;

  -- Only allow kicking during lobby phase
  IF v_session.status != 'lobby' THEN
    RAISE EXCEPTION 'Can only kick captains during the lobby phase';
  END IF;

  -- Get the captain user_id before clearing (for participant cleanup)
  IF p_team = 'team1' THEN
    v_kicked_user_id := v_session.team1_captain_id;
  ELSE
    v_kicked_user_id := v_session.team2_captain_id;
  END IF;

  -- Clear captain fields for this team
  IF p_team = 'team1' THEN
    -- Check there's actually a captain to kick
    IF v_session.team1_captain_id IS NULL AND v_session.team1_captain_display_name IS NULL THEN
      RAISE EXCEPTION 'No captain to kick from this team';
    END IF;

    UPDATE live_draft_sessions SET
      team1_captain_id = NULL,
      team1_captain_display_name = NULL,
      team1_captain_avatar_url = NULL,
      team1_captain_role = NULL,
      team1_captain_role_team_name = NULL,
      team1_side = NULL,
      team1_ready = FALSE
    WHERE id = p_session_id;
  ELSE
    -- Check there's actually a captain to kick
    IF v_session.team2_captain_id IS NULL AND v_session.team2_captain_display_name IS NULL THEN
      RAISE EXCEPTION 'No captain to kick from this team';
    END IF;

    UPDATE live_draft_sessions SET
      team2_captain_id = NULL,
      team2_captain_display_name = NULL,
      team2_captain_avatar_url = NULL,
      team2_captain_role = NULL,
      team2_captain_role_team_name = NULL,
      team2_side = NULL,
      team2_ready = FALSE
    WHERE id = p_session_id;
  END IF;

  -- Delete participant record for logged-in kicked user
  IF v_kicked_user_id IS NOT NULL THEN
    DELETE FROM live_draft_participants
    WHERE session_id = p_session_id AND user_id = v_kicked_user_id;
  END IF;

  -- Also delete anonymous captain participants (user_id IS NULL, is_captain = true)
  -- that match this session
  IF v_kicked_user_id IS NULL THEN
    DELETE FROM live_draft_participants
    WHERE session_id = p_session_id
      AND user_id IS NULL
      AND is_captain = TRUE;
  END IF;

  RETURN json_build_object(
    'success', true,
    'session_id', p_session_id,
    'team', p_team
  );
END;
$$;

GRANT EXECUTE ON FUNCTION kick_live_draft_captain TO authenticated;
