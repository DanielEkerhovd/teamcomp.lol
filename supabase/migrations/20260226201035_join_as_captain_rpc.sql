-- Create RPC function for joining as captain (supports both logged-in and anonymous users)
CREATE OR REPLACE FUNCTION join_live_draft_as_captain(
  p_session_id UUID,
  p_team TEXT, -- 'team1' or 'team2'
  p_display_name TEXT,
  p_avatar_url TEXT DEFAULT NULL,
  p_role TEXT DEFAULT NULL,
  p_role_team_name TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_session RECORD;
  v_captain_field TEXT;
  v_display_name_field TEXT;
  v_avatar_url_field TEXT;
  v_role_field TEXT;
  v_role_team_name_field TEXT;
  v_other_captain_field TEXT;
  v_other_display_name_field TEXT;
  v_existing_captain_id UUID;
  v_existing_captain_display_name TEXT;
  v_other_captain_id UUID;
  v_other_captain_display_name TEXT;
BEGIN
  -- Get current user (may be null for anonymous)
  v_user_id := auth.uid();

  -- Validate team parameter
  IF p_team NOT IN ('team1', 'team2') THEN
    RAISE EXCEPTION 'Invalid team parameter';
  END IF;

  -- Validate display name
  IF p_display_name IS NULL OR TRIM(p_display_name) = '' THEN
    RAISE EXCEPTION 'Display name is required';
  END IF;

  -- Get session
  SELECT * INTO v_session FROM live_draft_sessions WHERE id = p_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  -- Set field names based on team
  IF p_team = 'team1' THEN
    v_captain_field := 'team1_captain_id';
    v_display_name_field := 'team1_captain_display_name';
    v_avatar_url_field := 'team1_captain_avatar_url';
    v_role_field := 'team1_captain_role';
    v_role_team_name_field := 'team1_captain_role_team_name';
    v_other_captain_field := 'team2_captain_id';
    v_other_display_name_field := 'team2_captain_display_name';
    v_existing_captain_id := v_session.team1_captain_id;
    v_existing_captain_display_name := v_session.team1_captain_display_name;
    v_other_captain_id := v_session.team2_captain_id;
    v_other_captain_display_name := v_session.team2_captain_display_name;
  ELSE
    v_captain_field := 'team2_captain_id';
    v_display_name_field := 'team2_captain_display_name';
    v_avatar_url_field := 'team2_captain_avatar_url';
    v_role_field := 'team2_captain_role';
    v_role_team_name_field := 'team2_captain_role_team_name';
    v_other_captain_field := 'team1_captain_id';
    v_other_display_name_field := 'team1_captain_display_name';
    v_existing_captain_id := v_session.team2_captain_id;
    v_existing_captain_display_name := v_session.team2_captain_display_name;
    v_other_captain_id := v_session.team1_captain_id;
    v_other_captain_display_name := v_session.team1_captain_display_name;
  END IF;

  -- Check if slot is taken by someone else
  IF v_existing_captain_id IS NOT NULL AND v_existing_captain_id != v_user_id THEN
    RAISE EXCEPTION 'This team already has a captain';
  END IF;

  -- For anonymous users, check if display name matches (re-join check)
  IF v_existing_captain_id IS NULL AND v_existing_captain_display_name IS NOT NULL
     AND v_existing_captain_display_name != TRIM(p_display_name) THEN
    RAISE EXCEPTION 'This team already has a captain';
  END IF;

  -- Check user is not already captain of the other team (logged-in users)
  IF v_user_id IS NOT NULL AND v_other_captain_id = v_user_id THEN
    RAISE EXCEPTION 'You are already captain of the other team';
  END IF;

  -- For anonymous, check by display name
  IF v_user_id IS NULL AND v_other_captain_display_name = TRIM(p_display_name) THEN
    RAISE EXCEPTION 'You are already captain of the other team';
  END IF;

  -- Update session with new captain
  IF p_team = 'team1' THEN
    UPDATE live_draft_sessions SET
      team1_captain_id = v_user_id,
      team1_captain_display_name = TRIM(p_display_name),
      team1_captain_avatar_url = p_avatar_url,
      team1_captain_role = p_role,
      team1_captain_role_team_name = p_role_team_name
    WHERE id = p_session_id;
  ELSE
    UPDATE live_draft_sessions SET
      team2_captain_id = v_user_id,
      team2_captain_display_name = TRIM(p_display_name),
      team2_captain_avatar_url = p_avatar_url,
      team2_captain_role = p_role,
      team2_captain_role_team_name = p_role_team_name
    WHERE id = p_session_id;
  END IF;

  -- Return success with session ID
  RETURN json_build_object(
    'success', true,
    'session_id', p_session_id,
    'team', p_team,
    'user_id', v_user_id
  );
END;
$$;

-- Grant execute permission to anonymous and authenticated users
GRANT EXECUTE ON FUNCTION join_live_draft_as_captain TO anon, authenticated;
