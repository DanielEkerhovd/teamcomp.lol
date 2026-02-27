-- Migration: Live Draft Sessions
-- Real-time collaborative draft tool for multi-game series

-- Enable pgcrypto for gen_random_bytes
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================
-- LIVE DRAFT SESSIONS TABLE
-- ============================================

CREATE TABLE public.live_draft_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- NULL if anonymous creator

  -- Teams
  blue_team_name TEXT NOT NULL DEFAULT 'Blue Team',
  red_team_name TEXT NOT NULL DEFAULT 'Red Team',
  blue_captain_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  red_captain_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  blue_captain_display_name TEXT, -- For non-logged-in captains
  red_captain_display_name TEXT,

  -- Linked resources (for logged-in users) - TEXT type to match existing tables
  blue_linked_draft_id TEXT REFERENCES public.draft_sessions(id) ON DELETE SET NULL,
  red_linked_draft_id TEXT REFERENCES public.draft_sessions(id) ON DELETE SET NULL,
  blue_linked_team_id TEXT REFERENCES public.my_teams(id) ON DELETE SET NULL,
  red_linked_team_id TEXT REFERENCES public.my_teams(id) ON DELETE SET NULL,
  blue_linked_enemy_id TEXT REFERENCES public.enemy_teams(id) ON DELETE SET NULL,
  red_linked_enemy_id TEXT REFERENCES public.enemy_teams(id) ON DELETE SET NULL,

  -- Config
  draft_mode TEXT NOT NULL DEFAULT 'normal' CHECK (draft_mode IN ('normal', 'fearless', 'ironman')),
  side_selection_rule TEXT NOT NULL DEFAULT 'loser_chooses' CHECK (side_selection_rule IN ('loser_chooses', 'open')),
  planned_games INTEGER NOT NULL DEFAULT 3,
  pick_time_seconds INTEGER NOT NULL DEFAULT 30,
  ban_time_seconds INTEGER NOT NULL DEFAULT 30,

  -- State
  status TEXT NOT NULL DEFAULT 'lobby' CHECK (status IN ('lobby', 'in_progress', 'paused', 'completed', 'cancelled')),
  current_game_number INTEGER NOT NULL DEFAULT 1,

  -- Invite tokens
  invite_token TEXT NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(16), 'hex'),
  spectator_token TEXT NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(16), 'hex'),

  -- Timestamps
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_live_draft_sessions_created_by ON public.live_draft_sessions(created_by);
CREATE INDEX idx_live_draft_sessions_status ON public.live_draft_sessions(status);
CREATE INDEX idx_live_draft_sessions_invite_token ON public.live_draft_sessions(invite_token);
CREATE INDEX idx_live_draft_sessions_spectator_token ON public.live_draft_sessions(spectator_token);
CREATE INDEX idx_live_draft_sessions_created ON public.live_draft_sessions(created_at DESC);

-- ============================================
-- LIVE DRAFT GAMES TABLE
-- ============================================

CREATE TABLE public.live_draft_games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.live_draft_sessions(id) ON DELETE CASCADE,
  game_number INTEGER NOT NULL,

  -- Side assignment (team1 = session creator's team, team2 = opponent)
  blue_side_team TEXT NOT NULL DEFAULT 'team1' CHECK (blue_side_team IN ('team1', 'team2')),

  -- Draft state
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'side_selection', 'drafting', 'completed', 'editing')),
  current_phase TEXT CHECK (current_phase IN ('ban1', 'pick1', 'ban2', 'pick2')),
  current_turn TEXT CHECK (current_turn IN ('blue', 'red')),
  current_action_index INTEGER NOT NULL DEFAULT 0,

  -- Timer (server-authoritative)
  turn_started_at TIMESTAMPTZ,

  -- Results (5-element arrays, NULL = gray/missed pick)
  blue_bans TEXT[] NOT NULL DEFAULT ARRAY[NULL, NULL, NULL, NULL, NULL]::TEXT[],
  red_bans TEXT[] NOT NULL DEFAULT ARRAY[NULL, NULL, NULL, NULL, NULL]::TEXT[],
  blue_picks TEXT[] NOT NULL DEFAULT ARRAY[NULL, NULL, NULL, NULL, NULL]::TEXT[],
  red_picks TEXT[] NOT NULL DEFAULT ARRAY[NULL, NULL, NULL, NULL, NULL]::TEXT[],

  -- Track which picks were edited post-draft
  edited_picks JSONB NOT NULL DEFAULT '[]',

  -- Game result
  winner TEXT CHECK (winner IN ('blue', 'red')),

  -- Timestamps
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(session_id, game_number)
);

-- Indexes
CREATE INDEX idx_live_draft_games_session ON public.live_draft_games(session_id);
CREATE INDEX idx_live_draft_games_status ON public.live_draft_games(status);

-- ============================================
-- LIVE DRAFT PARTICIPANTS TABLE
-- ============================================

CREATE TABLE public.live_draft_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.live_draft_sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Participant type
  participant_type TEXT NOT NULL CHECK (participant_type IN ('controller', 'spectator')),
  team TEXT CHECK (team IN ('blue', 'red')), -- NULL for spectators

  -- Display info
  display_name TEXT,

  -- Connection state
  is_connected BOOLEAN NOT NULL DEFAULT FALSE,
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),

  -- Permissions
  is_captain BOOLEAN NOT NULL DEFAULT FALSE,

  -- Timestamps
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Unique constraint: one entry per user per session (but allow multiple anonymous spectators)
  CONSTRAINT unique_user_per_session UNIQUE NULLS NOT DISTINCT (session_id, user_id)
);

-- Indexes
CREATE INDEX idx_live_draft_participants_session ON public.live_draft_participants(session_id);
CREATE INDEX idx_live_draft_participants_user ON public.live_draft_participants(user_id);
CREATE INDEX idx_live_draft_participants_connected ON public.live_draft_participants(session_id, is_connected);

-- ============================================
-- LIVE DRAFT UNAVAILABLE CHAMPIONS TABLE
-- ============================================

CREATE TABLE public.live_draft_unavailable_champions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.live_draft_sessions(id) ON DELETE CASCADE,
  champion_id TEXT NOT NULL,
  from_game INTEGER NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('picked', 'banned')),
  team TEXT CHECK (team IN ('blue', 'red')), -- For Fearless per-team tracking

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Unique per champion per team per session
  UNIQUE(session_id, champion_id, team)
);

-- Indexes
CREATE INDEX idx_live_draft_unavailable_session ON public.live_draft_unavailable_champions(session_id);

-- ============================================
-- LIVE DRAFT ACTIONS TABLE
-- ============================================

CREATE TABLE public.live_draft_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES public.live_draft_games(id) ON DELETE CASCADE,

  action_index INTEGER NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('ban', 'pick', 'timeout')),
  team TEXT NOT NULL CHECK (team IN ('blue', 'red')),
  champion_id TEXT, -- NULL for timeout
  performed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(game_id, action_index)
);

-- Indexes
CREATE INDEX idx_live_draft_actions_game ON public.live_draft_actions(game_id);

-- ============================================
-- LIVE DRAFT MESSAGES TABLE
-- ============================================

CREATE TABLE public.live_draft_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.live_draft_sessions(id) ON DELETE CASCADE,

  -- Sender info
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,

  content TEXT NOT NULL CHECK (char_length(content) > 0 AND char_length(content) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_live_draft_messages_session ON public.live_draft_messages(session_id, created_at);

-- ============================================
-- ENABLE RLS
-- ============================================

ALTER TABLE public.live_draft_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_draft_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_draft_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_draft_unavailable_champions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_draft_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_draft_messages ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES - LIVE DRAFT SESSIONS
-- ============================================

-- Anyone can view sessions (needed for joining via token)
CREATE POLICY "Anyone can view live draft sessions" ON public.live_draft_sessions
  FOR SELECT USING (true);

-- Anyone can create sessions (no auth required)
CREATE POLICY "Anyone can create live draft sessions" ON public.live_draft_sessions
  FOR INSERT WITH CHECK (true);

-- Captains and creator can update session
CREATE POLICY "Captains and creator can update sessions" ON public.live_draft_sessions
  FOR UPDATE USING (
    auth.uid() = created_by
    OR auth.uid() = blue_captain_id
    OR auth.uid() = red_captain_id
  );

-- Only creator can delete session
CREATE POLICY "Creator can delete sessions" ON public.live_draft_sessions
  FOR DELETE USING (auth.uid() = created_by);

-- ============================================
-- RLS POLICIES - LIVE DRAFT GAMES
-- ============================================

-- Anyone can view games (needed for spectators)
CREATE POLICY "Anyone can view live draft games" ON public.live_draft_games
  FOR SELECT USING (true);

-- Session captains can insert/update games
CREATE POLICY "Captains can manage games" ON public.live_draft_games
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.live_draft_sessions s
      WHERE s.id = session_id
      AND (auth.uid() = s.blue_captain_id OR auth.uid() = s.red_captain_id OR auth.uid() = s.created_by)
    )
  );

-- ============================================
-- RLS POLICIES - LIVE DRAFT PARTICIPANTS
-- ============================================

-- Anyone can view participants
CREATE POLICY "Anyone can view participants" ON public.live_draft_participants
  FOR SELECT USING (true);

-- Anyone can join as participant
CREATE POLICY "Anyone can join sessions" ON public.live_draft_participants
  FOR INSERT WITH CHECK (true);

-- Users can update their own participant record
CREATE POLICY "Users can update own participant record" ON public.live_draft_participants
  FOR UPDATE USING (auth.uid() = user_id OR user_id IS NULL);

-- Users can leave sessions
CREATE POLICY "Users can leave sessions" ON public.live_draft_participants
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- RLS POLICIES - UNAVAILABLE CHAMPIONS
-- ============================================

-- Anyone can view unavailable champions
CREATE POLICY "Anyone can view unavailable champions" ON public.live_draft_unavailable_champions
  FOR SELECT USING (true);

-- Captains can manage unavailable champions
CREATE POLICY "Captains can manage unavailable champions" ON public.live_draft_unavailable_champions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.live_draft_sessions s
      WHERE s.id = session_id
      AND (auth.uid() = s.blue_captain_id OR auth.uid() = s.red_captain_id OR auth.uid() = s.created_by)
    )
  );

-- ============================================
-- RLS POLICIES - DRAFT ACTIONS
-- ============================================

-- Anyone can view actions
CREATE POLICY "Anyone can view draft actions" ON public.live_draft_actions
  FOR SELECT USING (true);

-- Captains can insert actions
CREATE POLICY "Captains can insert actions" ON public.live_draft_actions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.live_draft_games g
      JOIN public.live_draft_sessions s ON s.id = g.session_id
      WHERE g.id = game_id
      AND (auth.uid() = s.blue_captain_id OR auth.uid() = s.red_captain_id)
    )
  );

-- ============================================
-- RLS POLICIES - MESSAGES
-- ============================================

-- Anyone can view messages
CREATE POLICY "Anyone can view messages" ON public.live_draft_messages
  FOR SELECT USING (true);

-- Only captains can send messages
CREATE POLICY "Captains can send messages" ON public.live_draft_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.live_draft_sessions s
      WHERE s.id = session_id
      AND (auth.uid() = s.blue_captain_id OR auth.uid() = s.red_captain_id)
    )
  );

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Get session by invite token
CREATE OR REPLACE FUNCTION public.get_live_draft_session_by_token(token TEXT)
RETURNS public.live_draft_sessions AS $$
BEGIN
  RETURN (
    SELECT s.*
    FROM public.live_draft_sessions s
    WHERE s.invite_token = token OR s.spectator_token = token
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Join session as controller
CREATE OR REPLACE FUNCTION public.join_live_draft_as_controller(
  p_session_id UUID,
  p_team TEXT,
  p_display_name TEXT DEFAULT NULL
)
RETURNS public.live_draft_participants AS $$
DECLARE
  v_participant public.live_draft_participants;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();

  -- Check if team slot is available
  IF p_team = 'blue' THEN
    IF EXISTS (
      SELECT 1 FROM public.live_draft_sessions
      WHERE id = p_session_id AND blue_captain_id IS NOT NULL AND blue_captain_id != v_user_id
    ) THEN
      RAISE EXCEPTION 'Blue team captain slot is already taken';
    END IF;
  ELSIF p_team = 'red' THEN
    IF EXISTS (
      SELECT 1 FROM public.live_draft_sessions
      WHERE id = p_session_id AND red_captain_id IS NOT NULL AND red_captain_id != v_user_id
    ) THEN
      RAISE EXCEPTION 'Red team captain slot is already taken';
    END IF;
  END IF;

  -- Insert or update participant
  INSERT INTO public.live_draft_participants (
    session_id, user_id, participant_type, team, display_name, is_captain, is_connected
  )
  VALUES (
    p_session_id, v_user_id, 'controller', p_team, p_display_name, TRUE, TRUE
  )
  ON CONFLICT (session_id, user_id) DO UPDATE SET
    participant_type = 'controller',
    team = p_team,
    display_name = COALESCE(p_display_name, live_draft_participants.display_name),
    is_captain = TRUE,
    is_connected = TRUE,
    last_seen_at = NOW()
  RETURNING * INTO v_participant;

  -- Update session captain
  IF p_team = 'blue' THEN
    UPDATE public.live_draft_sessions
    SET blue_captain_id = v_user_id,
        blue_captain_display_name = p_display_name,
        updated_at = NOW()
    WHERE id = p_session_id;
  ELSE
    UPDATE public.live_draft_sessions
    SET red_captain_id = v_user_id,
        red_captain_display_name = p_display_name,
        updated_at = NOW()
    WHERE id = p_session_id;
  END IF;

  RETURN v_participant;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Join session as spectator
CREATE OR REPLACE FUNCTION public.join_live_draft_as_spectator(
  p_session_id UUID,
  p_display_name TEXT DEFAULT NULL
)
RETURNS public.live_draft_participants AS $$
DECLARE
  v_participant public.live_draft_participants;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();

  INSERT INTO public.live_draft_participants (
    session_id, user_id, participant_type, display_name, is_connected
  )
  VALUES (
    p_session_id, v_user_id, 'spectator', p_display_name, TRUE
  )
  ON CONFLICT (session_id, user_id) DO UPDATE SET
    is_connected = TRUE,
    last_seen_at = NOW()
  RETURNING * INTO v_participant;

  RETURN v_participant;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update participant connection status
CREATE OR REPLACE FUNCTION public.update_live_draft_connection(
  p_session_id UUID,
  p_is_connected BOOLEAN
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.live_draft_participants
  SET is_connected = p_is_connected,
      last_seen_at = NOW()
  WHERE session_id = p_session_id
  AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Submit draft action (ban or pick)
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
  v_is_blue_captain BOOLEAN;
  v_action_type TEXT;
  v_pick_index INTEGER;
BEGIN
  v_user_id := auth.uid();

  -- Get game and session
  SELECT * INTO v_game FROM public.live_draft_games WHERE id = p_game_id;
  SELECT * INTO v_session FROM public.live_draft_sessions WHERE id = v_game.session_id;

  -- Verify it's the user's turn
  v_is_blue_captain := (v_user_id = v_session.blue_captain_id);

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
      UPDATE public.live_draft_games SET blue_bans = v_game.blue_bans WHERE id = p_game_id;
    ELSE
      v_pick_index := array_position(v_game.red_bans, NULL) - 1;
      v_game.red_bans[v_pick_index + 1] := p_champion_id;
      UPDATE public.live_draft_games SET red_bans = v_game.red_bans WHERE id = p_game_id;
    END IF;
  ELSE
    IF v_game.current_turn = 'blue' THEN
      v_pick_index := array_position(v_game.blue_picks, NULL) - 1;
      v_game.blue_picks[v_pick_index + 1] := p_champion_id;
      UPDATE public.live_draft_games SET blue_picks = v_game.blue_picks WHERE id = p_game_id;
    ELSE
      v_pick_index := array_position(v_game.red_picks, NULL) - 1;
      v_game.red_picks[v_pick_index + 1] := p_champion_id;
      UPDATE public.live_draft_games SET red_picks = v_game.red_picks WHERE id = p_game_id;
    END IF;
  END IF;

  RETURN v_action;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- UPDATE TRIGGERS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_live_draft_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_live_draft_sessions_updated_at
  BEFORE UPDATE ON public.live_draft_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_live_draft_updated_at();

CREATE TRIGGER update_live_draft_games_updated_at
  BEFORE UPDATE ON public.live_draft_games
  FOR EACH ROW EXECUTE FUNCTION public.update_live_draft_updated_at();

-- ============================================
-- REALTIME SETUP
-- ============================================

-- Enable realtime for live draft tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_draft_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_draft_games;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_draft_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_draft_messages;
