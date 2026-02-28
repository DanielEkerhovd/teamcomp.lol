-- Fix: Add live_draft_unavailable_champions to the supabase_realtime publication.
-- This table was missing from the publication, which causes Supabase Realtime to
-- reject the postgres_changes subscription for it. Since this subscription is part
-- of the same channel as all other live draft subscriptions (including broadcast),
-- the channel enters an error/reconnect loop and ALL realtime events stop working.

ALTER PUBLICATION supabase_realtime ADD TABLE public.live_draft_unavailable_champions;
