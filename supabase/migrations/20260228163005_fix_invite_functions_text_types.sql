-- Fix: Change invite function parameter types from UUID to TEXT
-- The change_ids_to_text migration changed my_teams.id, team_members.team_id,
-- team_invites.team_id, and team_invites.player_slot_id to TEXT,
-- but the invite functions still used UUID parameters causing "text = uuid" errors.

-- Drop old function signatures (UUID params) so PostgREST finds the new TEXT ones
DROP FUNCTION IF EXISTS public.send_team_invite(UUID, TEXT, TEXT, UUID, BOOLEAN);
DROP FUNCTION IF EXISTS public.get_sent_team_invites(UUID);

-- Recreate send_team_invite with TEXT parameter types for team_id and player_slot_id
CREATE OR REPLACE FUNCTION public.send_team_invite(
  p_team_id TEXT,
  p_identifier TEXT,
  p_role TEXT DEFAULT 'player',
  p_player_slot_id TEXT DEFAULT NULL,
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

-- Recreate get_sent_team_invites with TEXT parameter type
CREATE OR REPLACE FUNCTION public.get_sent_team_invites(p_team_id TEXT)
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
