-- Fix RLS policies for live_draft_games
-- The issue: FOR ALL USING policy doesn't work well for INSERT when checking against NULL values
-- (NULL = NULL evaluates to NULL, not TRUE in SQL)

-- Drop the existing combined policy
DROP POLICY IF EXISTS "Captains can manage games" ON public.live_draft_games;

-- Create separate policies for each operation

-- SELECT: Anyone can view games (needed for spectators)
-- Note: This policy already exists as "Anyone can view live draft games"

-- INSERT: Allow inserting games into existing sessions
-- The FK constraint ensures the session exists
-- We check that the user is either:
-- 1. The creator of the session
-- 2. A captain of the session
-- 3. Or for anonymous sessions (created_by IS NULL), allow anonymous users
CREATE POLICY "Anyone can insert games into sessions" ON public.live_draft_games
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.live_draft_sessions s
      WHERE s.id = session_id
      AND (
        -- For authenticated users: check if they're creator or captain
        (auth.uid() IS NOT NULL AND (
          auth.uid() = s.created_by
          OR auth.uid() = s.blue_captain_id
          OR auth.uid() = s.red_captain_id
        ))
        -- For anonymous sessions: allow if session has no creator (anonymous session)
        OR (auth.uid() IS NULL AND s.created_by IS NULL)
      )
    )
  );

-- UPDATE: Only captains and creator can update games
CREATE POLICY "Captains can update games" ON public.live_draft_games
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.live_draft_sessions s
      WHERE s.id = session_id
      AND (
        (auth.uid() IS NOT NULL AND (
          auth.uid() = s.created_by
          OR auth.uid() = s.blue_captain_id
          OR auth.uid() = s.red_captain_id
        ))
        OR (auth.uid() IS NULL AND s.created_by IS NULL)
      )
    )
  );

-- DELETE: Only captains and creator can delete games
CREATE POLICY "Captains can delete games" ON public.live_draft_games
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.live_draft_sessions s
      WHERE s.id = session_id
      AND (
        (auth.uid() IS NOT NULL AND (
          auth.uid() = s.created_by
          OR auth.uid() = s.blue_captain_id
          OR auth.uid() = s.red_captain_id
        ))
        OR (auth.uid() IS NULL AND s.created_by IS NULL)
      )
    )
  );
