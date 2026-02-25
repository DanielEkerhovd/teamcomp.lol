-- Fix RLS recursion on team_members table
-- The previous policy referenced team_members from within team_members RLS, causing infinite recursion

-- Drop the problematic policies
DROP POLICY IF EXISTS "Owners and admins can manage team members" ON public.team_members;
DROP POLICY IF EXISTS "Members can leave team" ON public.team_members;

-- Drop existing functions first (they may have different signatures)
DROP FUNCTION IF EXISTS public.is_team_admin(UUID, UUID);
DROP FUNCTION IF EXISTS public.is_team_admin(TEXT, UUID);
DROP FUNCTION IF EXISTS public.is_team_owner(UUID, UUID);
DROP FUNCTION IF EXISTS public.is_team_owner(TEXT, UUID);

-- Create a helper function to check if user is admin of a team (bypasses RLS)
-- Note: team_id is TEXT because of earlier migration that changed IDs to TEXT
CREATE OR REPLACE FUNCTION public.is_team_admin(p_team_id TEXT, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = p_team_id
    AND user_id = p_user_id
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a helper function to check if user is owner of a team (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_team_owner(p_team_id TEXT, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.my_teams
    WHERE id = p_team_id
    AND user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- New policy: Owners can manage all team members
CREATE POLICY "Owners can manage team members" ON public.team_members
  FOR ALL USING (
    public.is_team_owner(team_id, auth.uid())
  );

-- New policy: Admins can manage team members (except owner role)
CREATE POLICY "Admins can manage non-owner members" ON public.team_members
  FOR ALL USING (
    public.is_team_admin(team_id, auth.uid())
    AND role != 'owner'
  );

-- Policy: Members can view their own membership
-- (This already exists as "Users can view own memberships")

-- Policy: Members can delete their own membership (leave team)
CREATE POLICY "Members can leave team" ON public.team_members
  FOR DELETE USING (
    auth.uid() = user_id
    AND role != 'owner'
  );

-- Also fix the players policy that might have similar issues
DROP POLICY IF EXISTS "Owners and admins can manage players" ON public.players;

CREATE POLICY "Owners can manage players" ON public.players
  FOR ALL USING (
    public.is_team_owner(team_id, auth.uid())
  );

CREATE POLICY "Admins can manage players" ON public.players
  FOR ALL USING (
    public.is_team_admin(team_id, auth.uid())
  );

-- Fix team_invites policies
DROP POLICY IF EXISTS "Owners and admins can manage invites" ON public.team_invites;

CREATE POLICY "Owners can manage invites" ON public.team_invites
  FOR ALL USING (
    public.is_team_owner(team_id, auth.uid())
  );

CREATE POLICY "Admins can manage invites" ON public.team_invites
  FOR ALL USING (
    public.is_team_admin(team_id, auth.uid())
  );
