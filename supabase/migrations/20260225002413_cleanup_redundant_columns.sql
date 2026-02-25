-- Migration: Cleanup redundant and unused columns/tables
-- This removes legacy data structures that have been superseded by newer formats

-- ============================================
-- DROP UNUSED TABLE
-- ============================================

-- champion_pool_state is completely unused in the application
DROP TABLE IF EXISTS public.champion_pool_state CASCADE;

-- ============================================
-- DROP LEGACY COLUMNS FROM PLAYERS
-- ============================================

-- champion_pool (old tiered format) has been replaced by champion_groups (grouped format)
ALTER TABLE public.players DROP COLUMN IF EXISTS champion_pool;
ALTER TABLE public.enemy_players DROP COLUMN IF EXISTS champion_pool;

-- notepad columns were added but never used in players/teams
ALTER TABLE public.players DROP COLUMN IF EXISTS notepad;
ALTER TABLE public.enemy_players DROP COLUMN IF EXISTS notepad;

-- ============================================
-- DROP UNUSED COLUMNS FROM TEAMS
-- ============================================

-- notepad columns on teams are unused (only draft_sessions uses notepad)
ALTER TABLE public.my_teams DROP COLUMN IF EXISTS notepad;
ALTER TABLE public.enemy_teams DROP COLUMN IF EXISTS notepad;

-- ============================================
-- DROP REDUNDANT COLUMNS FROM DRAFT_SESSIONS
-- ============================================

-- priority_picks and potential_bans are flat arrays that are now redundant
-- The grouped versions (priority_groups, ban_groups) contain the same data in a better structure
ALTER TABLE public.draft_sessions DROP COLUMN IF EXISTS priority_picks;
ALTER TABLE public.draft_sessions DROP COLUMN IF EXISTS potential_bans;
