-- Fix: Supabase Realtime requires REPLICA IDENTITY FULL on tables with RLS
-- to properly deliver postgres_changes events for UPDATE/DELETE operations.
-- Without this, the Realtime system cannot evaluate RLS policies on the new row
-- and silently drops events for remote subscribers.

ALTER TABLE public.live_draft_sessions REPLICA IDENTITY FULL;
ALTER TABLE public.live_draft_games REPLICA IDENTITY FULL;
ALTER TABLE public.live_draft_participants REPLICA IDENTITY FULL;
ALTER TABLE public.live_draft_messages REPLICA IDENTITY FULL;
ALTER TABLE public.live_draft_unavailable_champions REPLICA IDENTITY FULL;
