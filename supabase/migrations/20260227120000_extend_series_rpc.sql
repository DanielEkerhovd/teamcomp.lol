-- RPC function to extend a live draft series by 1 game (max 5)
-- Uses SECURITY DEFINER to bypass RLS, works for both logged-in and anonymous captains

CREATE OR REPLACE FUNCTION extend_live_draft_series(
  p_session_id UUID,
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
    RAISE EXCEPTION 'Only captains can extend the series';
  END IF;

  -- Check max 5 games
  IF v_session.planned_games >= 5 THEN
    RAISE EXCEPTION 'Series cannot exceed 5 games';
  END IF;

  -- Increment planned_games
  UPDATE live_draft_sessions
    SET planned_games = planned_games + 1
  WHERE id = p_session_id;

  RETURN json_build_object(
    'success', true,
    'session_id', p_session_id,
    'planned_games', v_session.planned_games + 1
  );
END;
$$;

GRANT EXECUTE ON FUNCTION extend_live_draft_series TO anon, authenticated;
