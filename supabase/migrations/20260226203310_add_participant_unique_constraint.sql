-- Add unique constraint on (session_id, user_id) for logged-in users
-- This allows the upsert to work correctly when a logged-in user rejoins a session
-- Note: We use a partial unique index that only applies when user_id is not null
-- Anonymous users (user_id IS NULL) can have multiple participant records

CREATE UNIQUE INDEX IF NOT EXISTS live_draft_participants_session_user_unique
ON live_draft_participants (session_id, user_id)
WHERE user_id IS NOT NULL;
