-- Drop the partial unique index (doesn't work with ON CONFLICT)
DROP INDEX IF EXISTS live_draft_participants_session_user_unique;

-- Create a proper unique constraint on (session_id, user_id)
-- In PostgreSQL, NULL values are treated as distinct in unique constraints,
-- so multiple rows with (session_id, NULL) are allowed (for anonymous users)
-- But rows with the same (session_id, user_id) where user_id IS NOT NULL will conflict
ALTER TABLE live_draft_participants
ADD CONSTRAINT live_draft_participants_session_user_unique
UNIQUE (session_id, user_id);
