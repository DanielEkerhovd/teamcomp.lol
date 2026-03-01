-- 1. Update get_team_memberships to include banned_at
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
      'ownerAvatar', p.avatar_url,
      'hasTeamPlan', mt.has_team_plan,
      'teamPlanStatus', mt.team_plan_status,
      'teamContentPermission', mt.team_content_permission,
      'bannedAt', mt.banned_at,
      'banReason', mt.ban_reason,
      'banExpiresAt', mt.ban_expires_at
    ) ORDER BY mt.name)
    FROM public.team_members tm
    JOIN public.my_teams mt ON mt.id = tm.team_id
    JOIN public.profiles p ON p.id = mt.user_id
    WHERE tm.user_id = auth.uid()
    AND tm.role != 'owner'
  ), '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update admin_ban_team to send notification to team owner and members
DROP FUNCTION IF EXISTS public.admin_ban_team(TEXT, TEXT, INTEGER);
CREATE OR REPLACE FUNCTION public.admin_ban_team(
  target_team_id  TEXT,
  p_reason        TEXT DEFAULT 'Banned by administrator',
  ban_hours       INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_tier    TEXT;
  v_team         RECORD;
  v_expires_at   TIMESTAMPTZ;
  v_title        TEXT;
  v_body         TEXT;
BEGIN
  SELECT p.tier INTO caller_tier FROM profiles p WHERE p.id = auth.uid();
  IF caller_tier IS DISTINCT FROM 'developer' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Forbidden');
  END IF;

  SELECT id, name, banned_at, user_id INTO v_team FROM my_teams WHERE id = target_team_id;
  IF v_team.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Team not found');
  END IF;

  IF v_team.banned_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Team is already banned');
  END IF;

  IF ban_hours IS NOT NULL AND ban_hours > 0 THEN
    v_expires_at := NOW() + (ban_hours || ' hours')::INTERVAL;
  ELSE
    v_expires_at := NULL;
  END IF;

  UPDATE my_teams
  SET banned_at      = NOW(),
      ban_reason     = COALESCE(NULLIF(TRIM(p_reason), ''), 'Banned by administrator'),
      ban_expires_at = v_expires_at,
      updated_at     = NOW()
  WHERE id = target_team_id;

  -- Build notification title and body
  IF v_expires_at IS NOT NULL THEN
    v_title := 'Team Suspended: ' || v_team.name;
    v_body  := COALESCE(NULLIF(TRIM(p_reason), ''), 'Banned by administrator')
               || ' (Expires in ' || ban_hours || ' hour'
               || CASE WHEN ban_hours > 1 THEN 's' ELSE '' END || ')';
  ELSE
    v_title := 'Team Banned: ' || v_team.name;
    v_body  := COALESCE(NULLIF(TRIM(p_reason), ''), 'Banned by administrator');
  END IF;

  -- Notify the team owner
  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (
    v_team.user_id,
    'moderation',
    v_title,
    v_body,
    jsonb_build_object(
      'action', 'team_banned',
      'team_id', target_team_id,
      'team_name', v_team.name,
      'moderator_id', auth.uid()::text,
      'ban_hours', ban_hours
    )
  );

  -- Also notify all team members
  INSERT INTO notifications (user_id, type, title, body, data)
  SELECT
    tm.user_id,
    'moderation',
    v_title,
    v_body,
    jsonb_build_object(
      'action', 'team_banned',
      'team_id', target_team_id,
      'team_name', v_team.name,
      'moderator_id', auth.uid()::text,
      'ban_hours', ban_hours
    )
  FROM team_members tm
  WHERE tm.team_id = target_team_id
    AND tm.user_id != v_team.user_id;

  RETURN jsonb_build_object('success', true);
END;
$$;
