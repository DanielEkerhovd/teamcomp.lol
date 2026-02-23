-- Migration: Rename contested_picks to priority_picks and add notepad column

-- Rename contested_picks to priority_picks in draft_sessions
ALTER TABLE public.draft_sessions
RENAME COLUMN contested_picks TO priority_picks;

-- Add notepad column for storing array of notes
ALTER TABLE public.draft_sessions
ADD COLUMN IF NOT EXISTS notepad JSONB DEFAULT '[]';

-- Also add notepad to other tables that might need it
ALTER TABLE public.my_teams
ADD COLUMN IF NOT EXISTS notepad JSONB DEFAULT '[]';

ALTER TABLE public.enemy_teams
ADD COLUMN IF NOT EXISTS notepad JSONB DEFAULT '[]';

ALTER TABLE public.players
ADD COLUMN IF NOT EXISTS notepad JSONB DEFAULT '[]';

ALTER TABLE public.enemy_players
ADD COLUMN IF NOT EXISTS notepad JSONB DEFAULT '[]';
