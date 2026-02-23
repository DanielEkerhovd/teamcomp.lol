-- Migration: Clean up priorities - remove redundant our_priorities column
-- priority_picks now stores the priority champion IDs (simplified from objects to strings)

-- Drop the redundant our_priorities column since priority_picks now serves this purpose
ALTER TABLE public.draft_sessions
DROP COLUMN IF EXISTS our_priorities;
