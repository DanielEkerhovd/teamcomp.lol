-- Fix infinite recursion in RLS policies
-- The issue is that team_members policies reference my_teams which references team_members

-- Drop the problematic policies
DROP POLICY IF EXISTS "Members can view teams" ON public.my_teams;
DROP POLICY IF EXISTS "Owners can manage team members" ON public.team_members;
DROP POLICY IF EXISTS "Members can view players" ON public.players;
DROP POLICY IF EXISTS "Players can update own slot" ON public.players;
DROP POLICY IF EXISTS "Members can view team draft sessions" ON public.draft_sessions;
DROP POLICY IF EXISTS "Members can view enemy teams via drafts" ON public.enemy_teams;
DROP POLICY IF EXISTS "Members can view enemy players via drafts" ON public.enemy_players;

-- Recreate team_members policies first (these don't reference other tables with RLS)
DROP POLICY IF EXISTS "Users can view own memberships" ON public.team_members;

-- Simple policy: users can see their own memberships
CREATE POLICY "Users can view own memberships" ON public.team_members
  FOR SELECT USING (user_id = auth.uid());

-- Owners can manage team members (use direct user_id check on my_teams)
CREATE POLICY "Owners can manage team members" ON public.team_members
  FOR ALL USING (
    team_id IN (
      SELECT id FROM public.my_teams WHERE user_id = auth.uid()
    )
  );

-- Now recreate my_teams policy for members (use direct check, no join to team_members)
CREATE POLICY "Members can view teams" ON public.my_teams
  FOR SELECT USING (
    id IN (
      SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
    )
  );

-- Players policies
CREATE POLICY "Members can view players" ON public.players
  FOR SELECT USING (
    team_id IN (
      SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Players can update own slot" ON public.players
  FOR UPDATE USING (
    id IN (
      SELECT player_slot_id FROM public.team_members 
      WHERE user_id = auth.uid() AND role = 'player' AND player_slot_id IS NOT NULL
    )
  );

-- Draft sessions for members
CREATE POLICY "Members can view team draft sessions" ON public.draft_sessions
  FOR SELECT USING (
    my_team_id IS NOT NULL AND
    my_team_id IN (
      SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
    )
  );

-- Enemy teams for members (via draft sessions they can access)
CREATE POLICY "Members can view enemy teams via drafts" ON public.enemy_teams
  FOR SELECT USING (
    id IN (
      SELECT ds.enemy_team_id 
      FROM public.draft_sessions ds
      WHERE ds.enemy_team_id IS NOT NULL
      AND ds.my_team_id IN (
        SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
      )
    )
  );

-- Enemy players for members
CREATE POLICY "Members can view enemy players via drafts" ON public.enemy_players
  FOR SELECT USING (
    team_id IN (
      SELECT ds.enemy_team_id 
      FROM public.draft_sessions ds
      WHERE ds.enemy_team_id IS NOT NULL
      AND ds.my_team_id IN (
        SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
      )
    )
  );
