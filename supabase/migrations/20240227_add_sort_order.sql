-- Migration: Add sort_order column to tables that need ordering

-- Add sort_order to draft_sessions
ALTER TABLE public.draft_sessions
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Add sort_order to my_teams
ALTER TABLE public.my_teams
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Add sort_order to enemy_teams
ALTER TABLE public.enemy_teams
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Add sort_order to players
ALTER TABLE public.players
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Add sort_order to enemy_players
ALTER TABLE public.enemy_players
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Add sort_order to player_pools
ALTER TABLE public.player_pools
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Add sort_order to custom_pools
ALTER TABLE public.custom_pools
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
