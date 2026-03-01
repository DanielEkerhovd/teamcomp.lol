-- Add is_favorite column to draft_sessions table
ALTER TABLE public.draft_sessions
ADD COLUMN is_favorite BOOLEAN DEFAULT FALSE;
