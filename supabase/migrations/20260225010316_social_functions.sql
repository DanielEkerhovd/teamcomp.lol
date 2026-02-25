-- Migration: Social RPC Functions
-- Functions for friend requests, messaging, and team management with notifications

-- ============================================
-- FRIEND REQUEST FUNCTIONS
-- ============================================

-- Send friend request by username or email
CREATE OR REPLACE FUNCTION public.send_friend_request(identifier TEXT)
RETURNS JSON AS $$
DECLARE
  target_user RECORD;
  existing_friendship RECORD;
  friendship_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be authenticated';
  END IF;

  IF length(trim(identifier)) < 2 THEN
    RETURN json_build_object('success', FALSE, 'error', 'Please enter a username or email');
  END IF;

  -- Find user by display_name (case-insensitive) or email
  SELECT * INTO target_user FROM public.profiles
  WHERE LOWER(display_name) = LOWER(trim(identifier))
     OR LOWER(email) = LOWER(trim(identifier));

  IF target_user IS NULL THEN
    RETURN json_build_object('success', FALSE, 'error', 'User not found');
  END IF;

  IF target_user.id = auth.uid() THEN
    RETURN json_build_object('success', FALSE, 'error', 'Cannot send friend request to yourself');
  END IF;

  -- Check if friendship already exists (in either direction)
  SELECT * INTO existing_friendship FROM public.friendships
  WHERE (user_id = auth.uid() AND friend_id = target_user.id)
     OR (user_id = target_user.id AND friend_id = auth.uid());

  IF existing_friendship IS NOT NULL THEN
    IF existing_friendship.status = 'accepted' THEN
      RETURN json_build_object('success', FALSE, 'error', 'You are already friends');
    ELSIF existing_friendship.status = 'pending' THEN
      IF existing_friendship.user_id = auth.uid() THEN
        RETURN json_build_object('success', FALSE, 'error', 'Friend request already sent');
      ELSE
        -- They sent us a request - auto-accept it
        UPDATE public.friendships
        SET status = 'accepted', accepted_at = NOW()
        WHERE id = existing_friendship.id;

        -- Notify them
        INSERT INTO public.notifications (user_id, type, title, body, data)
        SELECT existing_friendship.user_id, 'friend_accepted',
          'Friend request accepted',
          (SELECT display_name FROM public.profiles WHERE id = auth.uid()) || ' accepted your friend request',
          json_build_object('friendshipId', existing_friendship.id, 'friendId', auth.uid());

        RETURN json_build_object('success', TRUE, 'message', 'Friend request accepted');
      END IF;
    ELSIF existing_friendship.status = 'blocked' THEN
      RETURN json_build_object('success', FALSE, 'error', 'Cannot send friend request');
    END IF;
  END IF;

  -- Create friendship
  INSERT INTO public.friendships (user_id, friend_id, status)
  VALUES (auth.uid(), target_user.id, 'pending')
  RETURNING id INTO friendship_id;

  -- Create notification for target user
  INSERT INTO public.notifications (user_id, type, title, body, data)
  SELECT target_user.id, 'friend_request',
    'New friend request',
    p.display_name || ' wants to be your friend',
    json_build_object('friendshipId', friendship_id, 'fromUserId', auth.uid(), 'fromUserName', p.display_name)
  FROM public.profiles p WHERE p.id = auth.uid();

  RETURN json_build_object(
    'success', TRUE,
    'friendshipId', friendship_id,
    'targetUser', json_build_object(
      'id', target_user.id,
      'displayName', target_user.display_name,
      'avatarUrl', target_user.avatar_url
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Respond to friend request (accept/decline)
CREATE OR REPLACE FUNCTION public.respond_to_friend_request(
  p_friendship_id UUID,
  p_accept BOOLEAN
)
RETURNS JSON AS $$
DECLARE
  friendship RECORD;
  requester RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be authenticated';
  END IF;

  -- Find pending friendship where we are the recipient
  SELECT * INTO friendship FROM public.friendships
  WHERE id = p_friendship_id
  AND friend_id = auth.uid()
  AND status = 'pending';

  IF friendship IS NULL THEN
    RETURN json_build_object('success', FALSE, 'error', 'Friend request not found');
  END IF;

  -- Get requester info
  SELECT * INTO requester FROM public.profiles WHERE id = friendship.user_id;

  IF p_accept THEN
    -- Accept the request
    UPDATE public.friendships
    SET status = 'accepted', accepted_at = NOW()
    WHERE id = p_friendship_id;

    -- Notify the requester
    INSERT INTO public.notifications (user_id, type, title, body, data)
    SELECT friendship.user_id, 'friend_accepted',
      'Friend request accepted',
      p.display_name || ' accepted your friend request',
      json_build_object('friendshipId', p_friendship_id, 'friendId', auth.uid(), 'friendName', p.display_name)
    FROM public.profiles p WHERE p.id = auth.uid();

    RETURN json_build_object(
      'success', TRUE,
      'status', 'accepted',
      'friend', json_build_object(
        'id', requester.id,
        'displayName', requester.display_name,
        'avatarUrl', requester.avatar_url
      )
    );
  ELSE
    -- Decline - delete the request
    DELETE FROM public.friendships WHERE id = p_friendship_id;

    RETURN json_build_object('success', TRUE, 'status', 'declined');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remove friend
CREATE OR REPLACE FUNCTION public.remove_friend(p_friendship_id UUID)
RETURNS JSON AS $$
DECLARE
  friendship RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be authenticated';
  END IF;

  -- Find friendship where we are either party
  SELECT * INTO friendship FROM public.friendships
  WHERE id = p_friendship_id
  AND (user_id = auth.uid() OR friend_id = auth.uid());

  IF friendship IS NULL THEN
    RETURN json_build_object('success', FALSE, 'error', 'Friendship not found');
  END IF;

  DELETE FROM public.friendships WHERE id = p_friendship_id;

  RETURN json_build_object('success', TRUE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get friends list with details
CREATE OR REPLACE FUNCTION public.get_friends()
RETURNS JSON AS $$
BEGIN
  RETURN (
    SELECT json_build_object(
      'accepted', COALESCE((
        SELECT json_agg(json_build_object(
          'friendshipId', f.id,
          'friendId', CASE WHEN f.user_id = auth.uid() THEN f.friend_id ELSE f.user_id END,
          'displayName', p.display_name,
          'avatarUrl', p.avatar_url,
          'acceptedAt', f.accepted_at
        ) ORDER BY p.display_name)
        FROM public.friendships f
        JOIN public.profiles p ON p.id = CASE WHEN f.user_id = auth.uid() THEN f.friend_id ELSE f.user_id END
        WHERE (f.user_id = auth.uid() OR f.friend_id = auth.uid())
        AND f.status = 'accepted'
      ), '[]'::json),
      'pendingReceived', COALESCE((
        SELECT json_agg(json_build_object(
          'friendshipId', f.id,
          'fromUserId', f.user_id,
          'displayName', p.display_name,
          'avatarUrl', p.avatar_url,
          'createdAt', f.created_at
        ) ORDER BY f.created_at DESC)
        FROM public.friendships f
        JOIN public.profiles p ON p.id = f.user_id
        WHERE f.friend_id = auth.uid()
        AND f.status = 'pending'
      ), '[]'::json),
      'pendingSent', COALESCE((
        SELECT json_agg(json_build_object(
          'friendshipId', f.id,
          'toUserId', f.friend_id,
          'displayName', p.display_name,
          'avatarUrl', p.avatar_url,
          'createdAt', f.created_at
        ) ORDER BY f.created_at DESC)
        FROM public.friendships f
        JOIN public.profiles p ON p.id = f.friend_id
        WHERE f.user_id = auth.uid()
        AND f.status = 'pending'
      ), '[]'::json)
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- MESSAGING FUNCTIONS
-- ============================================

-- Send message to a friend
CREATE OR REPLACE FUNCTION public.send_message(
  p_to_user_id UUID,
  p_content TEXT
)
RETURNS JSON AS $$
DECLARE
  new_message_id UUID;
  sender RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be authenticated';
  END IF;

  IF length(trim(p_content)) = 0 THEN
    RETURN json_build_object('success', FALSE, 'error', 'Message cannot be empty');
  END IF;

  IF length(p_content) > 2000 THEN
    RETURN json_build_object('success', FALSE, 'error', 'Message too long (max 2000 characters)');
  END IF;

  -- Check if they are friends
  IF NOT EXISTS (
    SELECT 1 FROM public.friendships
    WHERE status = 'accepted'
    AND (
      (user_id = auth.uid() AND friend_id = p_to_user_id)
      OR (friend_id = auth.uid() AND user_id = p_to_user_id)
    )
  ) THEN
    RETURN json_build_object('success', FALSE, 'error', 'Can only message friends');
  END IF;

  -- Get sender info
  SELECT * INTO sender FROM public.profiles WHERE id = auth.uid();

  -- Insert message
  INSERT INTO public.messages (sender_id, recipient_id, content)
  VALUES (auth.uid(), p_to_user_id, trim(p_content))
  RETURNING id INTO new_message_id;

  -- Create notification for recipient
  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    p_to_user_id,
    'message',
    'New message',
    sender.display_name || ': ' || left(trim(p_content), 50) || CASE WHEN length(trim(p_content)) > 50 THEN '...' ELSE '' END,
    json_build_object('messageId', new_message_id, 'fromUserId', auth.uid(), 'fromUserName', sender.display_name)
  );

  RETURN json_build_object(
    'success', TRUE,
    'messageId', new_message_id,
    'createdAt', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get conversation with a user
CREATE OR REPLACE FUNCTION public.get_conversation(
  p_other_user_id UUID,
  p_limit INTEGER DEFAULT 50,
  p_before_id UUID DEFAULT NULL
)
RETURNS JSON AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be authenticated';
  END IF;

  RETURN COALESCE((
    SELECT json_agg(msg ORDER BY msg.created_at DESC)
    FROM (
      SELECT
        m.id,
        m.sender_id,
        m.recipient_id,
        m.content,
        m.read_at,
        m.created_at,
        p.display_name as sender_name,
        p.avatar_url as sender_avatar
      FROM public.messages m
      JOIN public.profiles p ON p.id = m.sender_id
      WHERE (
        (m.sender_id = auth.uid() AND m.recipient_id = p_other_user_id)
        OR (m.sender_id = p_other_user_id AND m.recipient_id = auth.uid())
      )
      AND (p_before_id IS NULL OR m.created_at < (SELECT created_at FROM public.messages WHERE id = p_before_id))
      ORDER BY m.created_at DESC
      LIMIT p_limit
    ) msg
  ), '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- TEAM MANAGEMENT FUNCTIONS
-- ============================================

-- Leave team (non-owners)
CREATE OR REPLACE FUNCTION public.leave_team(p_team_id UUID)
RETURNS JSON AS $$
DECLARE
  membership RECORD;
  team RECORD;
  leaving_user RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be authenticated';
  END IF;

  -- Find membership
  SELECT * INTO membership
  FROM public.team_members
  WHERE team_id = p_team_id
  AND user_id = auth.uid();

  IF membership IS NULL THEN
    RETURN json_build_object('success', FALSE, 'error', 'Not a member of this team');
  END IF;

  IF membership.role = 'owner' THEN
    RETURN json_build_object('success', FALSE, 'error', 'Owner cannot leave team. Transfer ownership or delete the team.');
  END IF;

  -- Get team and user info
  SELECT * INTO team FROM public.my_teams WHERE id = p_team_id;
  SELECT * INTO leaving_user FROM public.profiles WHERE id = auth.uid();

  -- Delete membership
  DELETE FROM public.team_members
  WHERE id = membership.id;

  -- Create notification for team owner
  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    team.user_id,
    'team_member_left',
    'Member left team',
    leaving_user.display_name || ' has left ' || team.name,
    json_build_object('teamId', p_team_id, 'userId', auth.uid(), 'userName', leaving_user.display_name)
  );

  RETURN json_build_object('success', TRUE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enhanced accept team invite with free tier check
DROP FUNCTION IF EXISTS public.accept_team_invite(TEXT);

CREATE OR REPLACE FUNCTION public.accept_team_invite(invite_token TEXT)
RETURNS JSON AS $$
DECLARE
  invite_record RECORD;
  new_member_id UUID;
  existing_owned_team RECORD;
  user_profile RECORD;
  team_record RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be authenticated to accept invite';
  END IF;

  -- Get user profile to check tier
  SELECT * INTO user_profile FROM public.profiles WHERE id = auth.uid();

  -- Find and validate invite
  SELECT * INTO invite_record
  FROM public.team_invites
  WHERE token = invite_token
  AND accepted_at IS NULL
  AND (expires_at IS NULL OR expires_at > NOW());

  IF invite_record IS NULL THEN
    RETURN json_build_object('success', FALSE, 'error', 'Invalid or expired invite');
  END IF;

  -- Get team info
  SELECT * INTO team_record
  FROM public.my_teams
  WHERE id = invite_record.team_id;

  IF team_record IS NULL THEN
    RETURN json_build_object('success', FALSE, 'error', 'Team no longer exists');
  END IF;

  -- Check if already a member
  IF EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = invite_record.team_id
    AND user_id = auth.uid()
  ) THEN
    RETURN json_build_object('success', FALSE, 'error', 'Already a member of this team');
  END IF;

  -- Check free tier conflict: does user already own a team?
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

  -- Mark invite as accepted
  UPDATE public.team_invites
  SET accepted_at = NOW(), accepted_by = auth.uid()
  WHERE id = invite_record.id;

  -- Create notification for team owner
  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    team_record.user_id,
    'team_member_joined',
    'New team member',
    user_profile.display_name || ' has joined ' || team_record.name || ' as ' || invite_record.role,
    json_build_object(
      'teamId', invite_record.team_id,
      'memberId', new_member_id,
      'memberName', user_profile.display_name,
      'role', invite_record.role
    )
  );

  RETURN json_build_object(
    'success', TRUE,
    'membershipId', new_member_id,
    'teamId', invite_record.team_id,
    'teamName', team_record.name,
    'role', invite_record.role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get teams where user is a member (not owner)
CREATE OR REPLACE FUNCTION public.get_team_memberships()
RETURNS JSON AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN '[]'::json;
  END IF;

  RETURN COALESCE((
    SELECT json_agg(json_build_object(
      'membershipId', tm.id,
      'teamId', tm.team_id,
      'teamName', mt.name,
      'role', tm.role,
      'canEditGroups', tm.can_edit_groups,
      'playerSlotId', tm.player_slot_id,
      'joinedAt', tm.joined_at,
      'ownerName', p.display_name,
      'ownerAvatar', p.avatar_url
    ) ORDER BY mt.name)
    FROM public.team_members tm
    JOIN public.my_teams mt ON mt.id = tm.team_id
    JOIN public.profiles p ON p.id = mt.user_id
    WHERE tm.user_id = auth.uid()
    AND tm.role != 'owner'
  ), '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Assign player slot to a team member
CREATE OR REPLACE FUNCTION public.assign_player_slot(
  p_membership_id UUID,
  p_player_slot_id UUID
)
RETURNS JSON AS $$
DECLARE
  membership RECORD;
  team RECORD;
  player_slot RECORD;
  assigned_user RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be authenticated';
  END IF;

  -- Get membership
  SELECT * INTO membership FROM public.team_members WHERE id = p_membership_id;

  IF membership IS NULL THEN
    RETURN json_build_object('success', FALSE, 'error', 'Membership not found');
  END IF;

  -- Check if caller is owner or admin of the team
  IF NOT EXISTS (
    SELECT 1 FROM public.my_teams WHERE id = membership.team_id AND user_id = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = membership.team_id
    AND user_id = auth.uid()
    AND role = 'admin'
  ) THEN
    RETURN json_build_object('success', FALSE, 'error', 'Only team owner or admin can assign player slots');
  END IF;

  -- Validate player slot belongs to the team
  IF p_player_slot_id IS NOT NULL THEN
    SELECT * INTO player_slot FROM public.players WHERE id = p_player_slot_id AND team_id = membership.team_id;
    IF player_slot IS NULL THEN
      RETURN json_build_object('success', FALSE, 'error', 'Player slot not found in this team');
    END IF;

    -- Unassign this slot from any other member
    UPDATE public.team_members
    SET player_slot_id = NULL
    WHERE team_id = membership.team_id
    AND player_slot_id = p_player_slot_id
    AND id != p_membership_id;
  END IF;

  -- Update membership
  UPDATE public.team_members
  SET player_slot_id = p_player_slot_id
  WHERE id = p_membership_id;

  -- Get assigned user for notification
  SELECT * INTO assigned_user FROM public.profiles WHERE id = membership.user_id;
  SELECT * INTO team FROM public.my_teams WHERE id = membership.team_id;

  -- Notify the assigned user
  IF p_player_slot_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      membership.user_id,
      'player_assignment',
      'Player slot assigned',
      'You have been assigned to ' || player_slot.summoner_name || ' (' || player_slot.role || ') in ' || team.name,
      json_build_object('teamId', membership.team_id, 'playerSlotId', p_player_slot_id, 'role', player_slot.role)
    );
  END IF;

  RETURN json_build_object('success', TRUE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update member permissions
CREATE OR REPLACE FUNCTION public.update_member_permissions(
  p_membership_id UUID,
  p_can_edit_groups BOOLEAN
)
RETURNS JSON AS $$
DECLARE
  membership RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be authenticated';
  END IF;

  -- Get membership
  SELECT * INTO membership FROM public.team_members WHERE id = p_membership_id;

  IF membership IS NULL THEN
    RETURN json_build_object('success', FALSE, 'error', 'Membership not found');
  END IF;

  -- Check if caller is owner or admin of the team
  IF NOT EXISTS (
    SELECT 1 FROM public.my_teams WHERE id = membership.team_id AND user_id = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = membership.team_id
    AND user_id = auth.uid()
    AND role = 'admin'
  ) THEN
    RETURN json_build_object('success', FALSE, 'error', 'Only team owner or admin can update permissions');
  END IF;

  -- Update permissions
  UPDATE public.team_members
  SET can_edit_groups = p_can_edit_groups
  WHERE id = p_membership_id;

  RETURN json_build_object('success', TRUE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
