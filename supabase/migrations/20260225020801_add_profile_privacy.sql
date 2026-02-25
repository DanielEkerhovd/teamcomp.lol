-- Migration: Add privacy setting to profiles
-- When is_private is true, users cannot receive friend requests but can still send them

-- Add is_private column to profiles
ALTER TABLE public.profiles
ADD COLUMN is_private BOOLEAN NOT NULL DEFAULT FALSE;

-- Update send_friend_request to check privacy setting
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

  -- Check if target user has a private profile
  IF target_user.is_private THEN
    RETURN json_build_object('success', FALSE, 'error', 'This user is not accepting friend requests');
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
