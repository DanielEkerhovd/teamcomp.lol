-- Add profile card customization columns
-- profile_card_bg: hex color string for solid background (Pro+ tier)
-- profile_card_gradient: second hex color for gradient end (Supporter+ tier)
-- profile_card_gradient_angle: gradient direction in degrees 0-360 (Supporter+ tier)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS profile_card_bg TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS profile_card_gradient TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS profile_card_gradient_angle INTEGER DEFAULT NULL;

-- Update apply_tier_limits to clear card customizations on downgrade
CREATE OR REPLACE FUNCTION public.apply_tier_limits()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tier IS DISTINCT FROM OLD.tier THEN
    CASE NEW.tier
      WHEN 'free' THEN
        NEW.max_teams := 1;
        NEW.max_enemy_teams := 10;
        NEW.max_drafts := 20;
        -- Clear all card customizations on downgrade to free
        NEW.profile_card_bg := NULL;
        NEW.profile_card_gradient := NULL;
        NEW.profile_card_gradient_angle := NULL;
        -- Set downgraded_at if coming from a paid tier
        IF OLD.tier IN ('beta', 'paid', 'supporter') THEN
          NEW.downgraded_at := NOW();
        END IF;
      WHEN 'beta' THEN
        NEW.max_teams := 3;
        NEW.max_enemy_teams := 30;
        NEW.max_drafts := 300;
        -- Beta users don't get card customization
        NEW.profile_card_bg := NULL;
        NEW.profile_card_gradient := NULL;
        NEW.profile_card_gradient_angle := NULL;
        NEW.downgraded_at := NULL;
        NEW.downgrade_reason := NULL;
      WHEN 'paid' THEN
        NEW.max_teams := 3;
        NEW.max_enemy_teams := 30;
        NEW.max_drafts := 300;
        -- Pro users get solid colors only; clear gradient if downgraded from supporter
        NEW.profile_card_gradient := NULL;
        NEW.profile_card_gradient_angle := NULL;
        NEW.downgraded_at := NULL;
        NEW.downgrade_reason := NULL;
      WHEN 'supporter' THEN
        NEW.max_teams := 3;
        NEW.max_enemy_teams := 30;
        NEW.max_drafts := 300;
        -- Supporter gets full customization; no clearing
        NEW.downgraded_at := NULL;
        NEW.downgrade_reason := NULL;
      WHEN 'admin', 'developer' THEN
        NEW.max_teams := 2147483647;
        NEW.max_enemy_teams := 2147483647;
        NEW.max_drafts := 2147483647;
        -- Full access; no clearing
        NEW.downgraded_at := NULL;
        NEW.downgrade_reason := NULL;
      ELSE
        NULL;
    END CASE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update get_friends to include card color data and tier for accepted friends
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
          'roleTeamName', t.name,
          'tier', p.tier,
          'profileCardBg', p.profile_card_bg,
          'profileCardGradient', p.profile_card_gradient,
          'profileCardGradientAngle', p.profile_card_gradient_angle
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
