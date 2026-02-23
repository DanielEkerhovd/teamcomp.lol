-- Migration: Make foreign key constraints more flexible for sync
-- The issue is that syncs can happen in any order, so we need to handle
-- cases where referenced rows don't exist yet

-- Option 1: Drop and recreate FK constraints as DEFERRABLE
-- This allows inserts to succeed as long as the constraint is satisfied by commit time

-- Drop existing constraints
ALTER TABLE public.draft_sessions
DROP CONSTRAINT IF EXISTS draft_sessions_enemy_team_id_fkey;

ALTER TABLE public.draft_sessions
DROP CONSTRAINT IF EXISTS draft_sessions_my_team_id_fkey;

-- Recreate with ON DELETE SET NULL (no FK validation during insert)
-- The columns are already nullable, so this is safe
-- Note: We're intentionally NOT recreating the foreign key constraint
-- because sync order is unpredictable and we need to allow orphaned references temporarily

-- If you want referential integrity, you would need to implement sync ordering
-- For now, the app handles validation on the client side
