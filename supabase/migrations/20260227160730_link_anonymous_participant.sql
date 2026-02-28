-- RPC function to link an anonymous live draft participant to an authenticated user.
-- Called when a user logs in / signs up while on a live draft page where they were
-- previously participating anonymously.

CREATE OR REPLACE FUNCTION link_anonymous_draft_participant(
  p_session_id UUID,
  p_participant_id UUID,
  p_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_participant RECORD;
  v_session RECORD;
BEGIN
  -- Must be authenticated
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Must be authenticated');
  END IF;

  -- Verify the caller is the user being linked
  IF auth.uid() != p_user_id THEN
    RETURN json_build_object('success', false, 'message', 'User mismatch');
  END IF;

  -- Verify participant exists and is anonymous
  SELECT * INTO v_participant
  FROM live_draft_participants
  WHERE id = p_participant_id
    AND session_id = p_session_id
    AND user_id IS NULL;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Anonymous participant not found');
  END IF;

  -- Update participant with user_id
  UPDATE live_draft_participants
  SET user_id = p_user_id
  WHERE id = p_participant_id;

  -- Update session captain fields if display name matches
  SELECT * INTO v_session FROM live_draft_sessions WHERE id = p_session_id;

  IF v_session.team1_captain_id IS NULL
     AND v_session.team1_captain_display_name = v_participant.display_name THEN
    UPDATE live_draft_sessions
    SET team1_captain_id = p_user_id
    WHERE id = p_session_id;
  END IF;

  IF v_session.team2_captain_id IS NULL
     AND v_session.team2_captain_display_name = v_participant.display_name THEN
    UPDATE live_draft_sessions
    SET team2_captain_id = p_user_id
    WHERE id = p_session_id;
  END IF;

  -- Update created_by if it was null (anonymous creator)
  IF v_session.created_by IS NULL THEN
    UPDATE live_draft_sessions
    SET created_by = p_user_id
    WHERE id = p_session_id;
  END IF;

  -- Track in user_sessions so it shows in "My Sessions"
  INSERT INTO live_draft_user_sessions (session_id, user_id)
  VALUES (p_session_id, p_user_id)
  ON CONFLICT (session_id, user_id) DO NOTHING;

  RETURN json_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION link_anonymous_draft_participant TO authenticated;
