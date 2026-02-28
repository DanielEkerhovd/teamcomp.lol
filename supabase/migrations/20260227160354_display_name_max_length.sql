-- Enforce max length constraints on user-provided text fields

-- profiles.display_name: max 30
ALTER TABLE public.profiles
  ADD CONSTRAINT chk_display_name_max_length
  CHECK (display_name IS NULL OR char_length(display_name) <= 30);

-- live_draft_sessions: session name, team names, captain display names: max 30
ALTER TABLE public.live_draft_sessions
  ADD CONSTRAINT chk_session_name_max_length
  CHECK (name IS NULL OR char_length(name) <= 30);

ALTER TABLE public.live_draft_sessions
  ADD CONSTRAINT chk_team1_name_max_length
  CHECK (team1_name IS NULL OR char_length(team1_name) <= 30);

ALTER TABLE public.live_draft_sessions
  ADD CONSTRAINT chk_team2_name_max_length
  CHECK (team2_name IS NULL OR char_length(team2_name) <= 30);

ALTER TABLE public.live_draft_sessions
  ADD CONSTRAINT chk_team1_captain_display_name_max_length
  CHECK (team1_captain_display_name IS NULL OR char_length(team1_captain_display_name) <= 30);

ALTER TABLE public.live_draft_sessions
  ADD CONSTRAINT chk_team2_captain_display_name_max_length
  CHECK (team2_captain_display_name IS NULL OR char_length(team2_captain_display_name) <= 30);

-- live_draft_participants.display_name: max 30
ALTER TABLE public.live_draft_participants
  ADD CONSTRAINT chk_participant_display_name_max_length
  CHECK (display_name IS NULL OR char_length(display_name) <= 30);

-- live_draft_messages.content: max 500
ALTER TABLE public.live_draft_messages
  ADD CONSTRAINT chk_message_content_max_length
  CHECK (content IS NULL OR char_length(content) <= 500);
