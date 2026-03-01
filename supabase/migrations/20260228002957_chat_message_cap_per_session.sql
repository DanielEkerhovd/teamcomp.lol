-- Cap chat messages at 50 per session.
-- Drop and recreate the insert policy with an additional count check.

DROP POLICY IF EXISTS "Captains can send messages" ON public.live_draft_messages;

CREATE POLICY "Captains can send messages" ON public.live_draft_messages
  FOR INSERT WITH CHECK (
    -- Must be a captain of the session
    EXISTS (
      SELECT 1 FROM public.live_draft_sessions s
      WHERE s.id = session_id
      AND (auth.uid() = s.team1_captain_id OR auth.uid() = s.team2_captain_id)
    )
    -- Session must have fewer than 50 messages
    AND (
      SELECT count(*) FROM public.live_draft_messages m
      WHERE m.session_id = live_draft_messages.session_id
    ) < 50
  );
