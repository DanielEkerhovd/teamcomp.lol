-- Track which users can see which sessions
-- When a user hides a session, their row is deleted
-- When no users are connected to a session, the session is deleted

CREATE TABLE IF NOT EXISTS live_draft_user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES live_draft_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('creator', 'captain', 'spectator')),
  hidden_at TIMESTAMPTZ DEFAULT NULL, -- NULL = visible, set = hidden
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, session_id)
);

-- Index for fast lookups
CREATE INDEX idx_user_sessions_user ON live_draft_user_sessions(user_id) WHERE hidden_at IS NULL;
CREATE INDEX idx_user_sessions_session ON live_draft_user_sessions(session_id);

-- RLS policies
ALTER TABLE live_draft_user_sessions ENABLE ROW LEVEL SECURITY;

-- Users can see their own visibility records
CREATE POLICY "Users can view own session visibility"
  ON live_draft_user_sessions FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own visibility records
CREATE POLICY "Users can create own session visibility"
  ON live_draft_user_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own visibility records (to hide)
CREATE POLICY "Users can update own session visibility"
  ON live_draft_user_sessions FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own visibility records
CREATE POLICY "Users can delete own session visibility"
  ON live_draft_user_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- Function to clean up orphaned sessions
CREATE OR REPLACE FUNCTION cleanup_orphaned_sessions()
RETURNS TRIGGER AS $$
BEGIN
  -- After a user hides or removes their visibility, check if session has any visible users
  -- Delete session if no users can see it anymore
  DELETE FROM live_draft_sessions
  WHERE id = OLD.session_id
    AND NOT EXISTS (
      SELECT 1 FROM live_draft_user_sessions
      WHERE session_id = OLD.session_id
        AND hidden_at IS NULL
    );

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to cleanup when visibility is hidden or deleted
CREATE TRIGGER trigger_cleanup_orphaned_sessions
  AFTER UPDATE OF hidden_at OR DELETE ON live_draft_user_sessions
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_orphaned_sessions();

-- Function to automatically add creator to user_sessions when session is created
CREATE OR REPLACE FUNCTION add_creator_to_user_sessions()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO live_draft_user_sessions (user_id, session_id, role)
    VALUES (NEW.created_by, NEW.id, 'creator')
    ON CONFLICT (user_id, session_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_add_creator_to_user_sessions
  AFTER INSERT ON live_draft_sessions
  FOR EACH ROW
  EXECUTE FUNCTION add_creator_to_user_sessions();

-- Function to add captains to user_sessions when they join
CREATE OR REPLACE FUNCTION add_captain_to_user_sessions()
RETURNS TRIGGER AS $$
BEGIN
  -- Team 1 captain added
  IF NEW.team1_captain_id IS NOT NULL AND (OLD.team1_captain_id IS NULL OR OLD.team1_captain_id != NEW.team1_captain_id) THEN
    INSERT INTO live_draft_user_sessions (user_id, session_id, role)
    VALUES (NEW.team1_captain_id, NEW.id, 'captain')
    ON CONFLICT (user_id, session_id) DO UPDATE SET role = 'captain', hidden_at = NULL;
  END IF;

  -- Team 2 captain added
  IF NEW.team2_captain_id IS NOT NULL AND (OLD.team2_captain_id IS NULL OR OLD.team2_captain_id != NEW.team2_captain_id) THEN
    INSERT INTO live_draft_user_sessions (user_id, session_id, role)
    VALUES (NEW.team2_captain_id, NEW.id, 'captain')
    ON CONFLICT (user_id, session_id) DO UPDATE SET role = 'captain', hidden_at = NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_add_captain_to_user_sessions
  AFTER UPDATE ON live_draft_sessions
  FOR EACH ROW
  EXECUTE FUNCTION add_captain_to_user_sessions();

-- Function to add spectators to user_sessions when they join
CREATE OR REPLACE FUNCTION add_spectator_to_user_sessions()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NOT NULL AND NEW.participant_type = 'spectator' THEN
    INSERT INTO live_draft_user_sessions (user_id, session_id, role)
    VALUES (NEW.user_id, NEW.session_id, 'spectator')
    ON CONFLICT (user_id, session_id) DO UPDATE SET hidden_at = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_add_spectator_to_user_sessions
  AFTER INSERT ON live_draft_participants
  FOR EACH ROW
  EXECUTE FUNCTION add_spectator_to_user_sessions();

-- Backfill existing sessions (for creators and captains)
INSERT INTO live_draft_user_sessions (user_id, session_id, role)
SELECT created_by, id, 'creator'
FROM live_draft_sessions
WHERE created_by IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO live_draft_user_sessions (user_id, session_id, role)
SELECT team1_captain_id, id, 'captain'
FROM live_draft_sessions
WHERE team1_captain_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO live_draft_user_sessions (user_id, session_id, role)
SELECT team2_captain_id, id, 'captain'
FROM live_draft_sessions
WHERE team2_captain_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Backfill existing spectators
INSERT INTO live_draft_user_sessions (user_id, session_id, role)
SELECT user_id, session_id, 'spectator'
FROM live_draft_participants
WHERE user_id IS NOT NULL AND participant_type = 'spectator'
ON CONFLICT DO NOTHING;
