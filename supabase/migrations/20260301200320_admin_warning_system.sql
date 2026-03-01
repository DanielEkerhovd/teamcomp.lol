-- Add 'warning' notification type for admin warnings
ALTER TABLE public.notifications
DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
ADD CONSTRAINT notifications_type_check CHECK (type IN (
  'team_invite',
  'team_member_joined',
  'team_member_left',
  'team_deleted',
  'team_role_changed',
  'player_assignment',
  'friend_request',
  'friend_accepted',
  'message',
  'draft_invite',
  'moderation',
  'warning',
  'ownership_transfer_request',
  'ownership_transfer_accepted',
  'ownership_transfer_declined',
  'ownership_transfer_cancelled'
));

-- RPC: Send a warning to a user
CREATE OR REPLACE FUNCTION public.admin_warn_user(
  target_user_id  UUID,
  p_message       TEXT DEFAULT 'You have received a warning from a moderator.',
  p_next_consequence TEXT DEFAULT NULL,
  p_category      TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_tier     TEXT;
  target_profile  RECORD;
  v_warning_count INTEGER;
BEGIN
  SELECT p.tier INTO caller_tier FROM profiles p WHERE p.id = auth.uid();
  IF caller_tier IS DISTINCT FROM 'developer' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Forbidden');
  END IF;

  SELECT id, tier, display_name INTO target_profile FROM profiles WHERE id = target_user_id;
  IF target_profile.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'User not found');
  END IF;
  IF target_profile.tier = 'developer' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Cannot warn a developer account');
  END IF;

  -- Count existing warnings
  SELECT COUNT(*) INTO v_warning_count
  FROM notifications
  WHERE user_id = target_user_id AND type = 'warning';

  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (
    target_user_id,
    'warning',
    'Moderation Warning',
    p_message,
    jsonb_build_object(
      'action', 'admin_warning',
      'moderator_id', auth.uid()::text,
      'next_consequence', COALESCE(p_next_consequence, ''),
      'category', COALESCE(p_category, ''),
      'warning_number', v_warning_count + 1
    )
  );

  RETURN jsonb_build_object('success', true, 'warning_count', v_warning_count + 1);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_warn_user(UUID, TEXT, TEXT, TEXT) TO authenticated;

-- RPC: Get warning count for a user (admin only)
CREATE OR REPLACE FUNCTION public.admin_get_warning_count(target_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_tier TEXT;
  v_count     INTEGER;
BEGIN
  SELECT p.tier INTO caller_tier FROM profiles p WHERE p.id = auth.uid();
  IF caller_tier IS DISTINCT FROM 'developer' THEN
    RETURN 0;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM notifications
  WHERE user_id = target_user_id AND type = 'warning';

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_warning_count(UUID) TO authenticated;
