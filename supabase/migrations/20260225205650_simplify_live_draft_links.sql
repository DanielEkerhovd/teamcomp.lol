-- Simplify Live Draft Links
-- - Remove side_selection_rule (not needed, captains select side in lobby)
-- - Remove spectator_token (single link for everyone)
-- - Remove 'side_selection' game status (not needed)

-- Drop side_selection_rule column
ALTER TABLE public.live_draft_sessions
  DROP COLUMN IF EXISTS side_selection_rule;

-- Drop spectator_token column and its index
DROP INDEX IF EXISTS idx_live_draft_sessions_spectator_token;
ALTER TABLE public.live_draft_sessions
  DROP COLUMN IF EXISTS spectator_token;

-- Update the game status check constraint to remove 'side_selection'
ALTER TABLE public.live_draft_games
  DROP CONSTRAINT IF EXISTS live_draft_games_status_check;

ALTER TABLE public.live_draft_games
  ADD CONSTRAINT live_draft_games_status_check
  CHECK (status IN ('pending', 'drafting', 'completed', 'editing'));

-- Update any existing games with 'side_selection' status to 'pending'
UPDATE public.live_draft_games
  SET status = 'pending'
  WHERE status = 'side_selection';
