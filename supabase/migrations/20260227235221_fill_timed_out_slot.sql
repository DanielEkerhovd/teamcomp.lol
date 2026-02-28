-- Allow captains to fill in a timed-out pick/ban slot with a real champion.
-- Updates the game arrays, the action record, and tracks fearless/ironman unavailability.

CREATE OR REPLACE FUNCTION public.fill_timed_out_slot(
  p_game_id UUID,
  p_slot TEXT,        -- e.g. 'blue_pick_2' or 'red_ban_1'
  p_champion_id TEXT  -- the champion to fill in
)
RETURNS void AS $$
DECLARE
  v_game public.live_draft_games;
  v_session public.live_draft_sessions;
  v_user_id UUID;
  v_side TEXT;
  v_type TEXT;
  v_index INTEGER;
  v_current_value TEXT;
  v_captain_id UUID;
  v_team_for_unavail TEXT;
BEGIN
  v_user_id := auth.uid();

  -- Parse slot string: 'blue_pick_2' -> side=blue, type=pick, index=2
  v_side  := split_part(p_slot, '_', 1);
  v_type  := split_part(p_slot, '_', 2);
  v_index := split_part(p_slot, '_', 3)::INTEGER;

  -- Validate parsed values
  IF v_side NOT IN ('blue', 'red') OR v_type NOT IN ('pick', 'ban') THEN
    RAISE EXCEPTION 'Invalid slot format: %', p_slot;
  END IF;
  IF v_index < 0 OR v_index > 4 THEN
    RAISE EXCEPTION 'Invalid slot index: %', v_index;
  END IF;

  -- Lock the game row
  SELECT * INTO v_game
    FROM public.live_draft_games
    WHERE id = p_game_id
    FOR UPDATE;

  IF v_game IS NULL THEN
    RAISE EXCEPTION 'Game not found';
  END IF;

  SELECT * INTO v_session
    FROM public.live_draft_sessions
    WHERE id = v_game.session_id;

  -- Determine captain for this side
  IF v_side = 'blue' THEN
    v_captain_id := CASE
      WHEN v_game.blue_side_team = 'team1' THEN v_session.team1_captain_id
      ELSE v_session.team2_captain_id
    END;
  ELSE
    v_captain_id := CASE
      WHEN v_game.blue_side_team = 'team1' THEN v_session.team2_captain_id
      ELSE v_session.team1_captain_id
    END;
  END IF;

  -- Verify caller is the captain of that side
  IF v_user_id IS DISTINCT FROM v_captain_id THEN
    RAISE EXCEPTION 'Only the team captain can fill timed-out slots';
  END IF;

  -- Read current value at the slot (PostgreSQL arrays are 1-indexed)
  IF v_type = 'pick' THEN
    IF v_side = 'blue' THEN v_current_value := v_game.blue_picks[v_index + 1];
    ELSE v_current_value := v_game.red_picks[v_index + 1];
    END IF;
  ELSE
    IF v_side = 'blue' THEN v_current_value := v_game.blue_bans[v_index + 1];
    ELSE v_current_value := v_game.red_bans[v_index + 1];
    END IF;
  END IF;

  -- Only allow filling __none__ slots
  IF v_current_value IS DISTINCT FROM '__none__' THEN
    RAISE EXCEPTION 'Slot is not timed out';
  END IF;

  -- Check the champion isn't already used in this game
  IF p_champion_id = ANY(v_game.blue_bans)
     OR p_champion_id = ANY(v_game.red_bans)
     OR p_champion_id = ANY(v_game.blue_picks)
     OR p_champion_id = ANY(v_game.red_picks) THEN
    RAISE EXCEPTION 'Champion is already used in this game';
  END IF;

  -- Check fearless/ironman restrictions from previous games
  IF v_session.draft_mode != 'normal' THEN
    IF v_session.draft_mode = 'fearless' THEN
      -- Fearless: only own team's picks carry over
      IF EXISTS (
        SELECT 1 FROM public.live_draft_unavailable_champions
        WHERE session_id = v_session.id
          AND champion_id = p_champion_id
          AND reason = 'picked'
          AND team = v_side
      ) THEN
        RAISE EXCEPTION 'Champion is unavailable (fearless)';
      END IF;
    ELSE
      -- Ironman: all previous picks and bans carry over
      IF EXISTS (
        SELECT 1 FROM public.live_draft_unavailable_champions
        WHERE session_id = v_session.id
          AND champion_id = p_champion_id
      ) THEN
        RAISE EXCEPTION 'Champion is unavailable (ironman)';
      END IF;
    END IF;
  END IF;

  -- Update the game array
  IF v_type = 'pick' AND v_side = 'blue' THEN
    v_game.blue_picks[v_index + 1] := p_champion_id;
    UPDATE public.live_draft_games SET blue_picks = v_game.blue_picks WHERE id = p_game_id;
  ELSIF v_type = 'pick' AND v_side = 'red' THEN
    v_game.red_picks[v_index + 1] := p_champion_id;
    UPDATE public.live_draft_games SET red_picks = v_game.red_picks WHERE id = p_game_id;
  ELSIF v_type = 'ban' AND v_side = 'blue' THEN
    v_game.blue_bans[v_index + 1] := p_champion_id;
    UPDATE public.live_draft_games SET blue_bans = v_game.blue_bans WHERE id = p_game_id;
  ELSE
    v_game.red_bans[v_index + 1] := p_champion_id;
    UPDATE public.live_draft_games SET red_bans = v_game.red_bans WHERE id = p_game_id;
  END IF;

  -- Update the action record
  UPDATE public.live_draft_actions
  SET champion_id = p_champion_id
  WHERE game_id = p_game_id
    AND team = v_side
    AND action_type = v_type
    AND champion_id = '__none__';

  -- Track unavailable champion for fearless/ironman
  IF v_session.draft_mode != 'normal' AND p_champion_id != '__none__' THEN
    v_team_for_unavail := CASE
      WHEN v_session.draft_mode = 'fearless' THEN v_side
      ELSE NULL
    END;

    INSERT INTO public.live_draft_unavailable_champions (
      session_id, champion_id, from_game, reason, team
    )
    SELECT
      v_session.id,
      p_champion_id,
      v_game.game_number,
      CASE WHEN v_type = 'ban' THEN 'banned' ELSE 'picked' END,
      v_team_for_unavail
    WHERE NOT EXISTS (
      SELECT 1 FROM public.live_draft_unavailable_champions
      WHERE session_id = v_session.id
        AND champion_id = p_champion_id
        AND team IS NOT DISTINCT FROM v_team_for_unavail
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
