-- RPC functions for captain operations that work for both logged-in and anonymous users
-- These use SECURITY DEFINER to bypass RLS since anonymous users can't pass auth.uid() checks

-- 1. Select side (blue/red) for a captain
CREATE OR REPLACE FUNCTION select_live_draft_side(
  p_session_id UUID,
  p_side TEXT, -- 'blue' or 'red'
  p_team TEXT DEFAULT NULL -- Required for anonymous: 'team1' or 'team2'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_session RECORD;
  v_is_team1_captain BOOLEAN;
  v_is_team2_captain BOOLEAN;
BEGIN
  v_user_id := auth.uid();

  -- Validate side
  IF p_side NOT IN ('blue', 'red') THEN
    RAISE EXCEPTION 'Invalid side. Must be blue or red';
  END IF;

  SELECT * INTO v_session FROM live_draft_sessions WHERE id = p_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  -- Determine which team the user is captain of
  IF v_user_id IS NOT NULL THEN
    v_is_team1_captain := v_session.team1_captain_id = v_user_id;
    v_is_team2_captain := v_session.team2_captain_id = v_user_id;
  ELSIF p_team IS NOT NULL THEN
    v_is_team1_captain := p_team = 'team1';
    v_is_team2_captain := p_team = 'team2';
  ELSE
    RAISE EXCEPTION 'Team parameter required for anonymous users';
  END IF;

  IF NOT v_is_team1_captain AND NOT v_is_team2_captain THEN
    RAISE EXCEPTION 'Only captains can select side';
  END IF;

  -- Check if side is taken by the other team
  IF v_is_team1_captain AND v_session.team2_side = p_side THEN
    RAISE EXCEPTION 'This side is already taken by the other team';
  END IF;
  IF v_is_team2_captain AND v_session.team1_side = p_side THEN
    RAISE EXCEPTION 'This side is already taken by the other team';
  END IF;

  -- Update session
  IF v_is_team1_captain THEN
    UPDATE live_draft_sessions SET
      team1_side = p_side,
      team1_ready = FALSE
    WHERE id = p_session_id;
  ELSE
    UPDATE live_draft_sessions SET
      team2_side = p_side,
      team2_ready = FALSE
    WHERE id = p_session_id;
  END IF;

  RETURN json_build_object(
    'success', true,
    'session_id', p_session_id,
    'team', CASE WHEN v_is_team1_captain THEN 'team1' ELSE 'team2' END,
    'side', p_side
  );
END;
$$;

GRANT EXECUTE ON FUNCTION select_live_draft_side TO anon, authenticated;

-- 2. Set ready state for a captain
CREATE OR REPLACE FUNCTION set_live_draft_ready(
  p_session_id UUID,
  p_ready BOOLEAN,
  p_team TEXT DEFAULT NULL -- Required for anonymous: 'team1' or 'team2'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_session RECORD;
  v_is_team1_captain BOOLEAN;
  v_is_team2_captain BOOLEAN;
BEGIN
  v_user_id := auth.uid();

  SELECT * INTO v_session FROM live_draft_sessions WHERE id = p_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  -- Determine which team the user is captain of
  IF v_user_id IS NOT NULL THEN
    v_is_team1_captain := v_session.team1_captain_id = v_user_id;
    v_is_team2_captain := v_session.team2_captain_id = v_user_id;
  ELSIF p_team IS NOT NULL THEN
    v_is_team1_captain := p_team = 'team1';
    v_is_team2_captain := p_team = 'team2';
  ELSE
    RAISE EXCEPTION 'Team parameter required for anonymous users';
  END IF;

  IF NOT v_is_team1_captain AND NOT v_is_team2_captain THEN
    RAISE EXCEPTION 'Only captains can set ready state';
  END IF;

  -- Must have selected a side before readying up
  IF v_is_team1_captain AND v_session.team1_side IS NULL THEN
    RAISE EXCEPTION 'Select a side before readying up';
  END IF;
  IF v_is_team2_captain AND v_session.team2_side IS NULL THEN
    RAISE EXCEPTION 'Select a side before readying up';
  END IF;

  -- Update ready state
  IF v_is_team1_captain THEN
    UPDATE live_draft_sessions SET team1_ready = p_ready WHERE id = p_session_id;
  ELSE
    UPDATE live_draft_sessions SET team2_ready = p_ready WHERE id = p_session_id;
  END IF;

  RETURN json_build_object(
    'success', true,
    'session_id', p_session_id,
    'team', CASE WHEN v_is_team1_captain THEN 'team1' ELSE 'team2' END,
    'ready', p_ready
  );
END;
$$;

GRANT EXECUTE ON FUNCTION set_live_draft_ready TO anon, authenticated;
