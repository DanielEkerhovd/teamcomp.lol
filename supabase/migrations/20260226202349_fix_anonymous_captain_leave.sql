-- Fix for anonymous users being unable to leave captain role
-- and duplicate key constraint issues

-- 1. Recreate the leave captain role function (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION leave_live_draft_captain_role(
  p_session_id UUID,
  p_team TEXT DEFAULT NULL -- Required for anonymous users: 'team1' or 'team2'
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
    RAISE EXCEPTION 'You are not a captain';
  END IF;

  -- Clear captain fields
  IF v_is_team1_captain THEN
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

  -- Delete participant record if logged in
  IF v_user_id IS NOT NULL THEN
    DELETE FROM live_draft_participants
    WHERE session_id = p_session_id AND user_id = v_user_id;
  END IF;

  RETURN json_build_object(
    'success', true,
    'session_id', p_session_id,
    'team', CASE WHEN v_is_team1_captain THEN 'team1' ELSE 'team2' END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION leave_live_draft_captain_role TO anon, authenticated;

-- 2. Drop the problematic unique constraint that blocks multiple anonymous users
-- The constraint "NULLS NOT DISTINCT" treats all NULL user_ids as duplicates
ALTER TABLE live_draft_participants
  DROP CONSTRAINT IF EXISTS unique_user_per_session;

-- 3. Add a new constraint that only applies to non-null user_ids
-- This allows multiple anonymous participants (user_id = NULL) per session
CREATE UNIQUE INDEX IF NOT EXISTS unique_logged_in_user_per_session
  ON live_draft_participants (session_id, user_id)
  WHERE user_id IS NOT NULL;
