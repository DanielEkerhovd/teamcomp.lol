-- Migration: Enhanced Team Permissions
-- Adds admin role and granular permissions for team members

-- ============================================
-- MODIFY TEAM_MEMBERS TABLE
-- ============================================

-- Add can_edit_groups permission flag
ALTER TABLE public.team_members
ADD COLUMN IF NOT EXISTS can_edit_groups BOOLEAN DEFAULT FALSE;

-- Drop old constraint and add new one with admin role
ALTER TABLE public.team_members
DROP CONSTRAINT IF EXISTS team_members_role_check;

ALTER TABLE public.team_members
ADD CONSTRAINT team_members_role_check
  CHECK (role IN ('owner', 'admin', 'player', 'viewer'));

-- ============================================
-- MODIFY TEAM_INVITES TABLE
-- ============================================

-- Add can_edit_groups to invites
ALTER TABLE public.team_invites
ADD COLUMN IF NOT EXISTS can_edit_groups BOOLEAN DEFAULT FALSE;

-- Update role constraint to include admin
ALTER TABLE public.team_invites
DROP CONSTRAINT IF EXISTS team_invites_role_check;

ALTER TABLE public.team_invites
ADD CONSTRAINT team_invites_role_check
  CHECK (role IN ('admin', 'player', 'viewer'));

-- ============================================
-- NEW RLS POLICIES FOR ADMIN ROLE
-- ============================================

-- Drop existing policies that need updating
DROP POLICY IF EXISTS "Owners can manage team members" ON public.team_members;
DROP POLICY IF EXISTS "Owners can manage players in own teams" ON public.players;
DROP POLICY IF EXISTS "Owners can manage invites" ON public.team_invites;

-- Admins can manage team members (except owner)
CREATE POLICY "Owners and admins can manage team members" ON public.team_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.my_teams
      WHERE my_teams.id = team_members.team_id
      AND my_teams.user_id = auth.uid()
    )
    OR (
      EXISTS (
        SELECT 1 FROM public.team_members tm
        WHERE tm.team_id = team_members.team_id
        AND tm.user_id = auth.uid()
        AND tm.role = 'admin'
      )
      AND team_members.role != 'owner'
    )
  );

-- Members can delete their own membership (leave team)
CREATE POLICY "Members can leave team" ON public.team_members
  FOR DELETE USING (
    auth.uid() = user_id
    AND role != 'owner'
  );

-- Owners and admins can manage all players in their teams
CREATE POLICY "Owners and admins can manage players" ON public.players
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.my_teams
      WHERE my_teams.id = players.team_id
      AND my_teams.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = players.team_id
      AND tm.user_id = auth.uid()
      AND tm.role = 'admin'
    )
  );

-- Owners and admins can manage invites
CREATE POLICY "Owners and admins can manage invites" ON public.team_invites
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.my_teams
      WHERE my_teams.id = team_invites.team_id
      AND my_teams.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = team_invites.team_id
      AND tm.user_id = auth.uid()
      AND tm.role = 'admin'
    )
  );

-- Note: leave_team and accept_team_invite functions will be created/updated
-- in a later migration after the notifications table exists
