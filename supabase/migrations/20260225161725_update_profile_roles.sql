-- Update profile roles: Remove 'custom' role, add new roles (manager, scout, content_creator, caster, journalist, streamer, developer)
-- Drop role_custom column as it's no longer needed

-- First, clean up any existing 'custom' roles by setting them to NULL
UPDATE public.profiles SET role = NULL WHERE role = 'custom';

-- Drop the old constraint
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS valid_role;

-- Add new constraint with updated role values
ALTER TABLE public.profiles
ADD CONSTRAINT valid_role CHECK (
  role IS NULL OR
  role IN ('team_owner', 'head_coach', 'coach', 'analyst', 'player', 'manager', 'scout', 'content_creator', 'caster', 'journalist', 'streamer', 'groupie', 'developer')
);

-- Drop the role_custom column
ALTER TABLE public.profiles DROP COLUMN IF EXISTS role_custom;

-- Update comment for documentation
COMMENT ON COLUMN public.profiles.role IS 'User role type: team_owner, head_coach, coach, analyst, player, manager, scout, content_creator, caster, journalist, streamer, groupie, or developer';

-- Update get_friends function to remove roleCustom from the response
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
