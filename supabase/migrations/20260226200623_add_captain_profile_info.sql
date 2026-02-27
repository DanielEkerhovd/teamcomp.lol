-- Add columns to store captain profile info directly on the session
-- This allows anonymous users to see captain avatars and roles without needing profile access

ALTER TABLE live_draft_sessions
ADD COLUMN IF NOT EXISTS team1_captain_avatar_url TEXT,
ADD COLUMN IF NOT EXISTS team1_captain_role TEXT,
ADD COLUMN IF NOT EXISTS team1_captain_role_team_name TEXT,
ADD COLUMN IF NOT EXISTS team2_captain_avatar_url TEXT,
ADD COLUMN IF NOT EXISTS team2_captain_role TEXT,
ADD COLUMN IF NOT EXISTS team2_captain_role_team_name TEXT;
