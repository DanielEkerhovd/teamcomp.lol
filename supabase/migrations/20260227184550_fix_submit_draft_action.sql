-- Fix submit_draft_action to:
-- 1. Use renamed columns (team1/team2 instead of blue/red)
-- 2. Advance game state atomically (no separate client-side advanceGame call)
-- This prevents 409 conflicts where the action is recorded but the game index isn't advanced.

CREATE OR REPLACE FUNCTION public.submit_draft_action(
  p_game_id UUID,
  p_champion_id TEXT
)
RETURNS public.live_draft_actions AS $$
DECLARE
  v_game public.live_draft_games;
  v_session public.live_draft_sessions;
  v_action public.live_draft_actions;
  v_user_id UUID;
  v_blue_captain_id UUID;
  v_red_captain_id UUID;
  v_is_blue_captain BOOLEAN;
  v_action_type TEXT;
  v_pick_index INTEGER;
  v_next_index INTEGER;
  -- Draft order lookup (20 steps: phase, turn)
  v_phases TEXT[] := ARRAY[
    'ban1','ban1','ban1','ban1','ban1','ban1',
    'pick1','pick1','pick1','pick1','pick1','pick1',
    'ban2','ban2','ban2','ban2',
    'pick2','pick2','pick2','pick2'
  ];
  v_turns TEXT[] := ARRAY[
    'blue','red','blue','red','blue','red',
    'blue','red','red','blue','blue','red',
    'red','blue','red','blue',
    'red','blue','blue','red'
  ];
BEGIN
  v_user_id := auth.uid();

  -- Get game and session
  SELECT * INTO v_game FROM public.live_draft_games WHERE id = p_game_id;
  IF v_game IS NULL THEN
    RAISE EXCEPTION 'Game not found';
  END IF;

  SELECT * INTO v_session FROM public.live_draft_sessions WHERE id = v_game.session_id;

  -- Determine which team captain is on which side using blue_side_team
  IF v_game.blue_side_team = 'team1' THEN
    v_blue_captain_id := v_session.team1_captain_id;
    v_red_captain_id := v_session.team2_captain_id;
  ELSE
    v_blue_captain_id := v_session.team2_captain_id;
    v_red_captain_id := v_session.team1_captain_id;
  END IF;

  -- Verify it's the user's turn
  v_is_blue_captain := (v_user_id = v_blue_captain_id);

  IF v_game.current_turn = 'blue' AND NOT v_is_blue_captain THEN
    RAISE EXCEPTION 'It is not your turn';
  END IF;

  IF v_game.current_turn = 'red' AND v_is_blue_captain THEN
    RAISE EXCEPTION 'It is not your turn';
  END IF;

  -- Determine action type
  IF v_game.current_phase IN ('ban1', 'ban2') THEN
    v_action_type := 'ban';
  ELSE
    v_action_type := 'pick';
  END IF;

  -- Insert the action
  INSERT INTO public.live_draft_actions (
    game_id, action_index, action_type, team, champion_id, performed_by
  )
  VALUES (
    p_game_id, v_game.current_action_index, v_action_type, v_game.current_turn, p_champion_id, v_user_id
  )
  RETURNING * INTO v_action;

  -- Update game state arrays
  IF v_action_type = 'ban' THEN
    IF v_game.current_turn = 'blue' THEN
      v_pick_index := array_position(v_game.blue_bans, NULL) - 1;
      v_game.blue_bans[v_pick_index + 1] := p_champion_id;
    ELSE
      v_pick_index := array_position(v_game.red_bans, NULL) - 1;
      v_game.red_bans[v_pick_index + 1] := p_champion_id;
    END IF;
  ELSE
    IF v_game.current_turn = 'blue' THEN
      v_pick_index := array_position(v_game.blue_picks, NULL) - 1;
      v_game.blue_picks[v_pick_index + 1] := p_champion_id;
    ELSE
      v_pick_index := array_position(v_game.red_picks, NULL) - 1;
      v_game.red_picks[v_pick_index + 1] := p_champion_id;
    END IF;
  END IF;

  -- Advance to next step (atomic — no separate client call needed)
  v_next_index := v_game.current_action_index + 1;

  IF v_next_index >= 20 THEN
    -- Draft is complete
    UPDATE public.live_draft_games SET
      blue_bans = v_game.blue_bans,
      red_bans = v_game.red_bans,
      blue_picks = v_game.blue_picks,
      red_picks = v_game.red_picks,
      status = 'completed',
      current_phase = NULL,
      current_turn = NULL,
      completed_at = NOW()
    WHERE id = p_game_id;
  ELSE
    -- Advance to next step
    UPDATE public.live_draft_games SET
      blue_bans = v_game.blue_bans,
      red_bans = v_game.red_bans,
      blue_picks = v_game.blue_picks,
      red_picks = v_game.red_picks,
      current_action_index = v_next_index,
      current_phase = v_phases[v_next_index + 1],  -- PostgreSQL arrays are 1-indexed
      current_turn = v_turns[v_next_index + 1],
      turn_started_at = NOW()
    WHERE id = p_game_id;
  END IF;

  RETURN v_action;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
