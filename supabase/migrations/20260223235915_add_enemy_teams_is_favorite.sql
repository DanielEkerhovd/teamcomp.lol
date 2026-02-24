-- Add is_favorite column to enemy_teams table
ALTER TABLE public.enemy_teams
ADD COLUMN is_favorite BOOLEAN DEFAULT FALSE;
