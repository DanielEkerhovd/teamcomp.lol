-- Add ready state columns to live_draft_sessions
ALTER TABLE live_draft_sessions
ADD COLUMN IF NOT EXISTS team1_ready boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS team2_ready boolean DEFAULT false;

-- Also need team2_side to track their side selection independently
-- (currently team2 side is derived from team1_side, but we want explicit selection)
ALTER TABLE live_draft_sessions
ADD COLUMN IF NOT EXISTS team2_side text CHECK (team2_side IN ('blue', 'red'));

-- Update: Creator should NOT be automatically team1 captain
-- Let people choose their team in the lobby
-- We'll handle this in application code by not setting team1_captain_id on creation
