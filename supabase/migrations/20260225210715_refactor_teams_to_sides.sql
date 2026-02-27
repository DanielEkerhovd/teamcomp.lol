-- Refactor: Teams are now team1/team2, sides are blue/red
-- Team names are independent of sides - captains choose their side in lobby

-- Rename team name columns
ALTER TABLE public.live_draft_sessions
  RENAME COLUMN blue_team_name TO team1_name;
ALTER TABLE public.live_draft_sessions
  RENAME COLUMN red_team_name TO team2_name;

-- Rename captain columns
ALTER TABLE public.live_draft_sessions
  RENAME COLUMN blue_captain_id TO team1_captain_id;
ALTER TABLE public.live_draft_sessions
  RENAME COLUMN red_captain_id TO team2_captain_id;
ALTER TABLE public.live_draft_sessions
  RENAME COLUMN blue_captain_display_name TO team1_captain_display_name;
ALTER TABLE public.live_draft_sessions
  RENAME COLUMN red_captain_display_name TO team2_captain_display_name;

-- Rename linked resource columns
ALTER TABLE public.live_draft_sessions
  RENAME COLUMN blue_linked_draft_id TO team1_linked_draft_id;
ALTER TABLE public.live_draft_sessions
  RENAME COLUMN red_linked_draft_id TO team2_linked_draft_id;
ALTER TABLE public.live_draft_sessions
  RENAME COLUMN blue_linked_team_id TO team1_linked_team_id;
ALTER TABLE public.live_draft_sessions
  RENAME COLUMN red_linked_team_id TO team2_linked_team_id;
ALTER TABLE public.live_draft_sessions
  RENAME COLUMN blue_linked_enemy_id TO team1_linked_enemy_id;
ALTER TABLE public.live_draft_sessions
  RENAME COLUMN red_linked_enemy_id TO team2_linked_enemy_id;

-- Add column to track which side team1 has chosen (team2 gets the opposite)
-- NULL = not chosen yet, 'blue' or 'red' = chosen
ALTER TABLE public.live_draft_sessions
  ADD COLUMN team1_side TEXT CHECK (team1_side IN ('blue', 'red'));

-- Update RLS policies to use new column names
DROP POLICY IF EXISTS "Captains and creator can update sessions" ON public.live_draft_sessions;
CREATE POLICY "Captains and creator can update sessions" ON public.live_draft_sessions
  FOR UPDATE USING (
    auth.uid() = created_by
    OR auth.uid() = team1_captain_id
    OR auth.uid() = team2_captain_id
  );

-- Update the helper functions to use new column names
CREATE OR REPLACE FUNCTION public.join_live_draft_as_controller(
  p_session_id UUID,
  p_team TEXT,  -- Now 'team1' or 'team2'
  p_side TEXT,  -- 'blue' or 'red'
  p_display_name TEXT DEFAULT NULL
)
RETURNS public.live_draft_participants AS $$
DECLARE
  v_participant public.live_draft_participants;
  v_user_id UUID;
  v_session public.live_draft_sessions;
BEGIN
  v_user_id := auth.uid();

  -- Get session
  SELECT * INTO v_session FROM public.live_draft_sessions WHERE id = p_session_id;

  -- Check if team slot is available
  IF p_team = 'team1' THEN
    IF v_session.team1_captain_id IS NOT NULL AND v_session.team1_captain_id != v_user_id THEN
      RAISE EXCEPTION 'Team 1 captain slot is already taken';
    END IF;
  ELSIF p_team = 'team2' THEN
    IF v_session.team2_captain_id IS NOT NULL AND v_session.team2_captain_id != v_user_id THEN
      RAISE EXCEPTION 'Team 2 captain slot is already taken';
    END IF;
  END IF;

  -- Check if side is available
  IF p_side = 'blue' THEN
    IF v_session.team1_side = 'blue' AND p_team = 'team2' THEN
      RAISE EXCEPTION 'Blue side is already taken by team 1';
    END IF;
    IF v_session.team1_side = 'red' AND p_team = 'team1' THEN
      RAISE EXCEPTION 'You already selected red side';
    END IF;
  ELSIF p_side = 'red' THEN
    IF v_session.team1_side = 'red' AND p_team = 'team2' THEN
      RAISE EXCEPTION 'Red side is already taken by team 1';
    END IF;
    IF v_session.team1_side = 'blue' AND p_team = 'team1' THEN
      RAISE EXCEPTION 'You already selected blue side';
    END IF;
  END IF;

  -- Determine which side maps to which participant team column
  -- We store the actual draft side (blue/red) in the participant record
  DECLARE
    v_draft_side TEXT;
  BEGIN
    v_draft_side := p_side;

    -- Insert or update participant
    INSERT INTO public.live_draft_participants (
      session_id, user_id, participant_type, team, display_name, is_captain, is_connected
    )
    VALUES (
      p_session_id, v_user_id, 'controller', v_draft_side, p_display_name, TRUE, TRUE
    )
    ON CONFLICT (session_id, user_id) DO UPDATE SET
      participant_type = 'controller',
      team = v_draft_side,
      display_name = COALESCE(p_display_name, live_draft_participants.display_name),
      is_captain = TRUE,
      is_connected = TRUE,
      last_seen_at = NOW()
    RETURNING * INTO v_participant;
  END;

  -- Update session captain and side
  IF p_team = 'team1' THEN
    UPDATE public.live_draft_sessions
    SET team1_captain_id = v_user_id,
        team1_captain_display_name = p_display_name,
        team1_side = p_side,
        updated_at = NOW()
    WHERE id = p_session_id;
  ELSE
    UPDATE public.live_draft_sessions
    SET team2_captain_id = v_user_id,
        team2_captain_display_name = p_display_name,
        updated_at = NOW()
    WHERE id = p_session_id;
  END IF;

  RETURN v_participant;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update RLS policies for games to use new column names
DROP POLICY IF EXISTS "Anyone can insert games into sessions" ON public.live_draft_games;
DROP POLICY IF EXISTS "Captains can update games" ON public.live_draft_games;
DROP POLICY IF EXISTS "Captains can delete games" ON public.live_draft_games;

CREATE POLICY "Anyone can insert games into sessions" ON public.live_draft_games
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.live_draft_sessions s
      WHERE s.id = session_id
      AND (
        (auth.uid() IS NOT NULL AND (
          auth.uid() = s.created_by
          OR auth.uid() = s.team1_captain_id
          OR auth.uid() = s.team2_captain_id
        ))
        OR (auth.uid() IS NULL AND s.created_by IS NULL)
      )
    )
  );

CREATE POLICY "Captains can update games" ON public.live_draft_games
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.live_draft_sessions s
      WHERE s.id = session_id
      AND (
        (auth.uid() IS NOT NULL AND (
          auth.uid() = s.created_by
          OR auth.uid() = s.team1_captain_id
          OR auth.uid() = s.team2_captain_id
        ))
        OR (auth.uid() IS NULL AND s.created_by IS NULL)
      )
    )
  );

CREATE POLICY "Captains can delete games" ON public.live_draft_games
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.live_draft_sessions s
      WHERE s.id = session_id
      AND (
        (auth.uid() IS NOT NULL AND (
          auth.uid() = s.created_by
          OR auth.uid() = s.team1_captain_id
          OR auth.uid() = s.team2_captain_id
        ))
        OR (auth.uid() IS NULL AND s.created_by IS NULL)
      )
    )
  );

-- Update RLS for unavailable champions
DROP POLICY IF EXISTS "Captains can manage unavailable champions" ON public.live_draft_unavailable_champions;
CREATE POLICY "Captains can manage unavailable champions" ON public.live_draft_unavailable_champions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.live_draft_sessions s
      WHERE s.id = session_id
      AND (auth.uid() = s.team1_captain_id OR auth.uid() = s.team2_captain_id OR auth.uid() = s.created_by)
    )
  );

-- Update RLS for draft actions
DROP POLICY IF EXISTS "Captains can insert actions" ON public.live_draft_actions;
CREATE POLICY "Captains can insert actions" ON public.live_draft_actions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.live_draft_games g
      JOIN public.live_draft_sessions s ON s.id = g.session_id
      WHERE g.id = game_id
      AND (auth.uid() = s.team1_captain_id OR auth.uid() = s.team2_captain_id)
    )
  );

-- Update RLS for messages
DROP POLICY IF EXISTS "Captains can send messages" ON public.live_draft_messages;
CREATE POLICY "Captains can send messages" ON public.live_draft_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.live_draft_sessions s
      WHERE s.id = session_id
      AND (auth.uid() = s.team1_captain_id OR auth.uid() = s.team2_captain_id)
    )
  );
