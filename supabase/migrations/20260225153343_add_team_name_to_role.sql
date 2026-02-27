-- Update get_friends to include team name for role association

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
          'acceptedAt', f.accepted_at,
          'role', p.role,
          'roleCustom', p.role_custom,
          'roleTeamName', t.name
        ) ORDER BY p.display_name)
        FROM public.friendships f
        JOIN public.profiles p ON p.id = CASE WHEN f.user_id = auth.uid() THEN f.friend_id ELSE f.user_id END
        LEFT JOIN public.my_teams t ON t.id = p.role_team_id
        WHERE (f.user_id = auth.uid() OR f.friend_id = auth.uid())
        AND f.status = 'accepted'
      ), '[]'::json),
      'pendingReceived', COALESCE((
        SELECT json_agg(json_build_object(
          'friendshipId', f.id,
          'fromUserId', f.user_id,
          'displayName', p.display_name,
          'avatarUrl', p.avatar_url,
          'createdAt', f.created_at,
          'role', p.role,
          'roleCustom', p.role_custom,
          'roleTeamName', t.name
        ) ORDER BY f.created_at DESC)
        FROM public.friendships f
        JOIN public.profiles p ON p.id = f.user_id
        LEFT JOIN public.my_teams t ON t.id = p.role_team_id
        WHERE f.friend_id = auth.uid()
        AND f.status = 'pending'
      ), '[]'::json),
      'pendingSent', COALESCE((
        SELECT json_agg(json_build_object(
          'friendshipId', f.id,
          'toUserId', f.friend_id,
          'displayName', p.display_name,
          'avatarUrl', p.avatar_url,
          'createdAt', f.created_at,
          'role', p.role,
          'roleCustom', p.role_custom,
          'roleTeamName', t.name
        ) ORDER BY f.created_at DESC)
        FROM public.friendships f
        JOIN public.profiles p ON p.id = f.friend_id
        LEFT JOIN public.my_teams t ON t.id = p.role_team_id
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
