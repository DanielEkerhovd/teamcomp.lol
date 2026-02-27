-- Migration: Add direct user invites to team_invites
-- Allows inviting users directly by username/email (not just via token link)

-- ============================================
-- MODIFY TEAM_INVITES TABLE
-- ============================================

-- Add invited_user_id column for direct invites
ALTER TABLE public.team_invites
ADD COLUMN IF NOT EXISTS invited_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Add status column to track invite state
ALTER TABLE public.team_invites
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'
CHECK (status IN ('pending', 'accepted', 'declined'));

-- Create index for efficient lookup of pending invites for a user
CREATE INDEX IF NOT EXISTS idx_team_invites_invited_user
ON public.team_invites(invited_user_id)
WHERE invited_user_id IS NOT NULL AND status = 'pending';

-- Create index for efficient lookup by team
CREATE INDEX IF NOT EXISTS idx_team_invites_team_pending
ON public.team_invites(team_id, status)
WHERE status = 'pending';

-- ============================================
-- RLS POLICIES FOR DIRECT INVITES
-- ============================================

-- Users can view invites sent to them
CREATE POLICY "Users can view invites sent to them" ON public.team_invites
  FOR SELECT USING (auth.uid() = invited_user_id);

-- Users can update invites sent to them (to accept/decline)
CREATE POLICY "Users can respond to team invites" ON public.team_invites
  FOR UPDATE USING (auth.uid() = invited_user_id AND status = 'pending');

-- ============================================
-- RPC FUNCTIONS
-- ============================================

-- Send team invite by username or email
CREATE OR REPLACE FUNCTION public.send_team_invite(
  p_team_id UUID,
  p_identifier TEXT,
  p_role TEXT DEFAULT 'player',
  p_player_slot_id UUID DEFAULT NULL,
  p_can_edit_groups BOOLEAN DEFAULT FALSE
)
RETURNS JSON AS $$
DECLARE
  target_user RECORD;
  team_record RECORD;
  existing_invite RECORD;
  existing_member RECORD;
  invite_id UUID;
  caller_is_owner BOOLEAN;
  caller_is_admin BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be authenticated';
  END IF;

  IF length(trim(p_identifier)) < 2 THEN
    RETURN json_build_object('success', FALSE, 'error', 'Please enter a username or email');
  END IF;

  -- Validate role
  IF p_role NOT IN ('admin', 'player', 'viewer') THEN
    RETURN json_build_object('success', FALSE, 'error', 'Invalid role');
  END IF;

  -- Get team info
  SELECT * INTO team_record FROM public.my_teams WHERE id = p_team_id;
  IF team_record IS NULL THEN
    RETURN json_build_object('success', FALSE, 'error', 'Team not found');
  END IF;

  -- Check caller permissions (must be owner or admin)
  caller_is_owner := (team_record.user_id = auth.uid());
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = p_team_id AND user_id = auth.uid() AND role = 'admin'
  ) INTO caller_is_admin;

  IF NOT caller_is_owner AND NOT caller_is_admin THEN
    RETURN json_build_object('success', FALSE, 'error', 'Only team owners and admins can invite members');
  END IF;

  -- Find user by display_name (case-insensitive) or email
  SELECT * INTO target_user FROM public.profiles
  WHERE LOWER(display_name) = LOWER(trim(p_identifier))
     OR LOWER(email) = LOWER(trim(p_identifier));

  IF target_user IS NULL THEN
    RETURN json_build_object('success', FALSE, 'error', 'User not found');
  END IF;

  IF target_user.id = auth.uid() THEN
    RETURN json_build_object('success', FALSE, 'error', 'Cannot invite yourself');
  END IF;

  -- Check if user is the team owner
  IF target_user.id = team_record.user_id THEN
    RETURN json_build_object('success', FALSE, 'error', 'Cannot invite the team owner');
  END IF;

  -- Check if already a member
  SELECT * INTO existing_member FROM public.team_members
  WHERE team_id = p_team_id AND user_id = target_user.id;

  IF existing_member IS NOT NULL THEN
    RETURN json_build_object('success', FALSE, 'error', 'User is already a team member');
  END IF;

  -- Check if invite already exists
  SELECT * INTO existing_invite FROM public.team_invites
  WHERE team_id = p_team_id
    AND invited_user_id = target_user.id
    AND status = 'pending';

  IF existing_invite IS NOT NULL THEN
    RETURN json_build_object('success', FALSE, 'error', 'Invite already sent to this user');
  END IF;

  -- Create the invite
  INSERT INTO public.team_invites (
    team_id,
    invited_user_id,
    role,
    player_slot_id,
    can_edit_groups,
    created_by,
    status,
    expires_at
  )
  VALUES (
    p_team_id,
    target_user.id,
    p_role,
    p_player_slot_id,
    p_can_edit_groups,
    auth.uid(),
    'pending',
    NOW() + INTERVAL '7 days'
  )
  RETURNING id INTO invite_id;

  -- Create notification for target user
  INSERT INTO public.notifications (user_id, type, title, body, data)
  SELECT
    target_user.id,
    'team_invite',
    'Team invitation',
    (SELECT display_name FROM public.profiles WHERE id = auth.uid()) || ' invited you to join ' || team_record.name || ' as ' || p_role,
    json_build_object(
      'inviteId', invite_id,
      'teamId', p_team_id,
      'teamName', team_record.name,
      'role', p_role,
      'fromUserId', auth.uid()
    );

  RETURN json_build_object(
    'success', TRUE,
    'inviteId', invite_id,
    'targetUser', json_build_object(
      'id', target_user.id,
      'displayName', target_user.display_name,
      'avatarUrl', target_user.avatar_url
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Respond to team invite (accept/decline)
CREATE OR REPLACE FUNCTION public.respond_to_team_invite(
  p_invite_id UUID,
  p_accept BOOLEAN
)
RETURNS JSON AS $$
DECLARE
  invite_record RECORD;
  team_record RECORD;
  user_profile RECORD;
  new_member_id UUID;
  existing_owned_team RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be authenticated';
  END IF;

  -- Find pending invite for this user
  SELECT * INTO invite_record FROM public.team_invites
  WHERE id = p_invite_id
    AND invited_user_id = auth.uid()
    AND status = 'pending';

  IF invite_record IS NULL THEN
    RETURN json_build_object('success', FALSE, 'error', 'Invite not found or already responded');
  END IF;

  -- Check expiration
  IF invite_record.expires_at IS NOT NULL AND invite_record.expires_at < NOW() THEN
    UPDATE public.team_invites SET status = 'declined' WHERE id = p_invite_id;
    RETURN json_build_object('success', FALSE, 'error', 'Invite has expired');
  END IF;

  -- Get team and user info
  SELECT * INTO team_record FROM public.my_teams WHERE id = invite_record.team_id;
  SELECT * INTO user_profile FROM public.profiles WHERE id = auth.uid();

  IF team_record IS NULL THEN
    UPDATE public.team_invites SET status = 'declined' WHERE id = p_invite_id;
    RETURN json_build_object('success', FALSE, 'error', 'Team no longer exists');
  END IF;

  IF p_accept THEN
    -- Check free tier conflict (user already owns a team)
    SELECT mt.* INTO existing_owned_team
    FROM public.my_teams mt
    WHERE mt.user_id = auth.uid()
    LIMIT 1;

    IF existing_owned_team IS NOT NULL AND user_profile.tier = 'free' THEN
      RETURN json_build_object(
        'success', FALSE,
        'conflict', 'free_tier_team_limit',
        'existingTeamId', existing_owned_team.id,
        'existingTeamName', existing_owned_team.name,
        'inviteTeamId', team_record.id,
        'inviteTeamName', team_record.name,
        'inviteRole', invite_record.role
      );
    END IF;

    -- Check if already a member (edge case)
    IF EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_id = invite_record.team_id AND user_id = auth.uid()
    ) THEN
      UPDATE public.team_invites SET status = 'accepted', accepted_at = NOW(), accepted_by = auth.uid() WHERE id = p_invite_id;
      RETURN json_build_object('success', FALSE, 'error', 'Already a member of this team');
    END IF;

    -- Create membership
    INSERT INTO public.team_members (team_id, user_id, role, player_slot_id, invited_by, can_edit_groups)
    VALUES (
      invite_record.team_id,
      auth.uid(),
      invite_record.role,
      invite_record.player_slot_id,
      invite_record.created_by,
      COALESCE(invite_record.can_edit_groups, FALSE)
    )
    RETURNING id INTO new_member_id;

    -- Update invite status
    UPDATE public.team_invites
    SET status = 'accepted', accepted_at = NOW(), accepted_by = auth.uid()
    WHERE id = p_invite_id;

    -- Notify team owner
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      team_record.user_id,
      'team_member_joined',
      'New team member',
      user_profile.display_name || ' accepted your invite to ' || team_record.name,
      json_build_object(
        'teamId', invite_record.team_id,
        'memberId', new_member_id,
        'memberName', user_profile.display_name,
        'role', invite_record.role
      )
    );

    RETURN json_build_object(
      'success', TRUE,
      'status', 'accepted',
      'membershipId', new_member_id,
      'teamId', invite_record.team_id,
      'teamName', team_record.name,
      'role', invite_record.role
    );
  ELSE
    -- Decline the invite
    UPDATE public.team_invites SET status = 'declined' WHERE id = p_invite_id;

    RETURN json_build_object('success', TRUE, 'status', 'declined');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get pending team invites for the current user
CREATE OR REPLACE FUNCTION public.get_pending_team_invites()
RETURNS JSON AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN '[]'::json;
  END IF;

  RETURN COALESCE((
    SELECT json_agg(json_build_object(
      'inviteId', ti.id,
      'teamId', ti.team_id,
      'teamName', mt.name,
      'role', ti.role,
      'canEditGroups', ti.can_edit_groups,
      'playerSlotId', ti.player_slot_id,
      'createdAt', ti.created_at,
      'expiresAt', ti.expires_at,
      'invitedBy', json_build_object(
        'id', p.id,
        'displayName', p.display_name,
        'avatarUrl', p.avatar_url
      )
    ) ORDER BY ti.created_at DESC)
    FROM public.team_invites ti
    JOIN public.my_teams mt ON mt.id = ti.team_id
    JOIN public.profiles p ON p.id = ti.created_by
    WHERE ti.invited_user_id = auth.uid()
      AND ti.status = 'pending'
      AND (ti.expires_at IS NULL OR ti.expires_at > NOW())
  ), '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cancel a pending team invite (for team owners/admins)
CREATE OR REPLACE FUNCTION public.cancel_team_invite(p_invite_id UUID)
RETURNS JSON AS $$
DECLARE
  invite_record RECORD;
  team_record RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be authenticated';
  END IF;

  -- Get invite
  SELECT * INTO invite_record FROM public.team_invites WHERE id = p_invite_id;

  IF invite_record IS NULL THEN
    RETURN json_build_object('success', FALSE, 'error', 'Invite not found');
  END IF;

  -- Get team
  SELECT * INTO team_record FROM public.my_teams WHERE id = invite_record.team_id;

  -- Check permissions
  IF team_record.user_id != auth.uid() AND NOT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = invite_record.team_id
      AND user_id = auth.uid()
      AND role = 'admin'
  ) THEN
    RETURN json_build_object('success', FALSE, 'error', 'Only team owner or admin can cancel invites');
  END IF;

  -- Delete the invite
  DELETE FROM public.team_invites WHERE id = p_invite_id;

  RETURN json_build_object('success', TRUE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get sent team invites for a team (for displaying in invite modal)
CREATE OR REPLACE FUNCTION public.get_sent_team_invites(p_team_id UUID)
RETURNS JSON AS $$
DECLARE
  team_record RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN '[]'::json;
  END IF;

  -- Get team and check permissions
  SELECT * INTO team_record FROM public.my_teams WHERE id = p_team_id;

  IF team_record IS NULL THEN
    RETURN '[]'::json;
  END IF;

  -- Check if user is owner or admin
  IF team_record.user_id != auth.uid() AND NOT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = p_team_id
      AND user_id = auth.uid()
      AND role = 'admin'
  ) THEN
    RETURN '[]'::json;
  END IF;

  RETURN COALESCE((
    SELECT json_agg(json_build_object(
      'inviteId', ti.id,
      'role', ti.role,
      'canEditGroups', ti.can_edit_groups,
      'playerSlotId', ti.player_slot_id,
      'createdAt', ti.created_at,
      'expiresAt', ti.expires_at,
      'status', ti.status,
      'invitedUser', CASE
        WHEN ti.invited_user_id IS NOT NULL THEN json_build_object(
          'id', p.id,
          'displayName', p.display_name,
          'avatarUrl', p.avatar_url
        )
        ELSE NULL
      END,
      'invitedEmail', ti.invited_email,
      'token', ti.token,
      'isDirectInvite', ti.invited_user_id IS NOT NULL
    ) ORDER BY ti.created_at DESC)
    FROM public.team_invites ti
    LEFT JOIN public.profiles p ON p.id = ti.invited_user_id
    WHERE ti.team_id = p_team_id
      AND ti.status = 'pending'
      AND (ti.expires_at IS NULL OR ti.expires_at > NOW())
  ), '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add team_invites to realtime publication (ignore error if already added)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.team_invites;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
