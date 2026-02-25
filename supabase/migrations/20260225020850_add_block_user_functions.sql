-- Migration: Add block/unblock user functions
-- Allows users to block and unblock other users

-- ============================================
-- BLOCK USER FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION public.block_user(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
  existing_friendship RECORD;
  blocked_user RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be authenticated';
  END IF;

  IF p_user_id = auth.uid() THEN
    RETURN json_build_object('success', FALSE, 'error', 'Cannot block yourself');
  END IF;

  -- Get blocked user info
  SELECT * INTO blocked_user FROM public.profiles WHERE id = p_user_id;

  IF blocked_user IS NULL THEN
    RETURN json_build_object('success', FALSE, 'error', 'User not found');
  END IF;

  -- Check if friendship already exists (in either direction)
  SELECT * INTO existing_friendship FROM public.friendships
  WHERE (user_id = auth.uid() AND friend_id = p_user_id)
     OR (user_id = p_user_id AND friend_id = auth.uid());

  IF existing_friendship IS NOT NULL THEN
    -- Delete the existing friendship and create a new blocked one where WE are the blocker
    DELETE FROM public.friendships WHERE id = existing_friendship.id;
  END IF;

  -- Create a blocked friendship where we are the user_id (blocker)
  INSERT INTO public.friendships (user_id, friend_id, status)
  VALUES (auth.uid(), p_user_id, 'blocked');

  RETURN json_build_object(
    'success', TRUE,
    'blockedUser', json_build_object(
      'id', blocked_user.id,
      'displayName', blocked_user.display_name,
      'avatarUrl', blocked_user.avatar_url
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- UNBLOCK USER FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION public.unblock_user(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
  blocked_friendship RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be authenticated';
  END IF;

  -- Find blocked friendship where WE are the blocker
  SELECT * INTO blocked_friendship FROM public.friendships
  WHERE user_id = auth.uid()
  AND friend_id = p_user_id
  AND status = 'blocked';

  IF blocked_friendship IS NULL THEN
    RETURN json_build_object('success', FALSE, 'error', 'User is not blocked');
  END IF;

  -- Delete the blocked friendship
  DELETE FROM public.friendships WHERE id = blocked_friendship.id;

  RETURN json_build_object('success', TRUE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- UPDATE GET_FRIENDS TO INCLUDE BLOCKED USERS
-- ============================================

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
      ), '[]'::json),
      'blocked', COALESCE((
        SELECT json_agg(json_build_object(
          'friendshipId', f.id,
          'blockedUserId', f.friend_id,
          'displayName', p.display_name,
          'avatarUrl', p.avatar_url,
          'blockedAt', f.created_at
        ) ORDER BY f.created_at DESC)
        FROM public.friendships f
        JOIN public.profiles p ON p.id = f.friend_id
        WHERE f.user_id = auth.uid()
        AND f.status = 'blocked'
      ), '[]'::json)
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
