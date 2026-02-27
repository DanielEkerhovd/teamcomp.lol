-- Fix RLS policy for live_draft_sessions updates
-- The issue: USING clause without WITH CHECK means the NEW row must also satisfy the condition
-- When a captain (who is not the creator) updates their captain_id to NULL (leaving),
-- the NEW row no longer has them as captain, so the implicit WITH CHECK fails.

-- Solution: Add explicit WITH CHECK (true) so anyone who passes USING can write the update
-- The USING clause already validates they're the creator or a captain

DROP POLICY IF EXISTS "Captains and creator can update sessions" ON public.live_draft_sessions;

CREATE POLICY "Captains and creator can update sessions" ON public.live_draft_sessions
  FOR UPDATE
  USING (
    -- Can update if you're the creator OR a captain (checks OLD row)
    auth.uid() = created_by
    OR auth.uid() = team1_captain_id
    OR auth.uid() = team2_captain_id
  )
  WITH CHECK (true);  -- If you passed USING, the update is allowed

-- Create RPC function for leaving captain role
-- This is still useful as a backup and for anonymous users
CREATE OR REPLACE FUNCTION leave_live_draft_captain_role(
  p_session_id UUID,
  p_team TEXT DEFAULT NULL -- Optional: 'team1' or 'team2' (required for anonymous users)
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
  -- Get current user (may be null for anonymous)
  v_user_id := auth.uid();

  -- Get session
  SELECT * INTO v_session FROM live_draft_sessions WHERE id = p_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  -- Determine which team the user is captain of
  IF v_user_id IS NOT NULL THEN
    v_is_team1_captain := v_session.team1_captain_id = v_user_id;
    v_is_team2_captain := v_session.team2_captain_id = v_user_id;
  ELSIF p_team IS NOT NULL THEN
    -- For anonymous users, trust the team parameter
    v_is_team1_captain := p_team = 'team1';
    v_is_team2_captain := p_team = 'team2';
  ELSE
    RAISE EXCEPTION 'Team parameter required for anonymous users';
  END IF;

  IF NOT v_is_team1_captain AND NOT v_is_team2_captain THEN
    RAISE EXCEPTION 'You are not a captain';
  END IF;

  -- Clear captain fields for this team
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

  -- Delete participant record for logged-in users
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

-- Grant execute permission to anonymous and authenticated users
GRANT EXECUTE ON FUNCTION leave_live_draft_captain_role TO anon, authenticated;
