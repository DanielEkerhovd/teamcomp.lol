-- Migration: Add draft_invite notification type and send_draft_invite RPC
-- Allows users to invite others to live draft sessions by username

-- ============================================
-- UPDATE NOTIFICATION TYPE CONSTRAINT
-- ============================================

ALTER TABLE public.notifications
DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
ADD CONSTRAINT notifications_type_check CHECK (type IN (
  'team_invite',
  'team_member_joined',
  'team_member_left',
  'team_role_changed',
  'player_assignment',
  'friend_request',
  'friend_accepted',
  'message',
  'draft_invite'
));

-- ============================================
-- RPC: send_draft_invite
-- ============================================

CREATE OR REPLACE FUNCTION public.send_draft_invite(
  p_session_id UUID,
  p_username TEXT
)
RETURNS JSON AS $$
DECLARE
  target_user RECORD;
  session_record RECORD;
  sender_name TEXT;
BEGIN
  -- Must be authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be authenticated';
  END IF;

  -- Validate input
  IF length(trim(p_username)) < 2 THEN
    RETURN json_build_object('success', FALSE, 'error', 'Please enter a valid username');
  END IF;

  -- Get session info
  SELECT * INTO session_record
  FROM public.live_draft_sessions
  WHERE id = p_session_id;

  IF session_record IS NULL THEN
    RETURN json_build_object('success', FALSE, 'error', 'Draft session not found');
  END IF;

  -- Session must be in lobby or in_progress status
  IF session_record.status NOT IN ('lobby', 'in_progress') THEN
    RETURN json_build_object('success', FALSE, 'error', 'This draft session is no longer active');
  END IF;

  -- Look up user by display_name (case-insensitive)
  SELECT id, display_name, avatar_url INTO target_user
  FROM public.profiles
  WHERE LOWER(display_name) = LOWER(trim(p_username));

  IF target_user IS NULL THEN
    RETURN json_build_object('success', FALSE, 'error', 'User not found');
  END IF;

  -- Prevent inviting yourself
  IF target_user.id = auth.uid() THEN
    RETURN json_build_object('success', FALSE, 'error', 'Cannot invite yourself');
  END IF;

  -- Prevent duplicate unread invites for the same session + user
  IF EXISTS (
    SELECT 1 FROM public.notifications
    WHERE user_id = target_user.id
      AND type = 'draft_invite'
      AND (data->>'sessionId')::UUID = p_session_id
      AND read_at IS NULL
  ) THEN
    RETURN json_build_object('success', FALSE, 'error', 'Invite already sent to this user');
  END IF;

  -- Get sender display name
  SELECT display_name INTO sender_name
  FROM public.profiles
  WHERE id = auth.uid();

  -- Create the notification
  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    target_user.id,
    'draft_invite',
    'Draft Invitation',
    COALESCE(sender_name, 'Someone') || ' invited you to join "' || session_record.name || '"',
    json_build_object(
      'sessionId', session_record.id,
      'sessionName', session_record.name,
      'inviteToken', session_record.invite_token,
      'fromUserId', auth.uid(),
      'fromDisplayName', sender_name
    )
  );

  RETURN json_build_object(
    'success', TRUE,
    'targetUser', json_build_object(
      'id', target_user.id,
      'displayName', target_user.display_name,
      'avatarUrl', target_user.avatar_url
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
