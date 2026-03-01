-- ============================================================
-- Moderation violations tracking + auto-ban system
-- ============================================================

-- 1. Create moderation_violations table
CREATE TABLE public.moderation_violations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  context    TEXT NOT NULL,
  content    TEXT,
  categories TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_moderation_violations_user_recent
  ON public.moderation_violations (user_id, created_at DESC);

ALTER TABLE public.moderation_violations ENABLE ROW LEVEL SECURITY;

-- 2. Record violation + auto-ban RPC
CREATE OR REPLACE FUNCTION public.record_moderation_violation(
  p_context    TEXT,
  p_content    TEXT DEFAULT NULL,
  p_categories TEXT[] DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id      UUID;
  v_count        INTEGER;
  v_threshold    INTEGER := 5;
  v_is_banned    BOOLEAN := false;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'recorded', false,
      'violation_count', 0,
      'threshold', v_threshold,
      'banned', false
    );
  END IF;

  -- Don't record violations for developers
  IF EXISTS (SELECT 1 FROM profiles WHERE id = v_user_id AND tier = 'developer') THEN
    RETURN jsonb_build_object(
      'recorded', false,
      'violation_count', 0,
      'threshold', v_threshold,
      'banned', false
    );
  END IF;

  -- Insert the violation
  INSERT INTO moderation_violations (user_id, context, content, categories)
  VALUES (v_user_id, p_context, p_content, p_categories);

  -- Count violations in the last hour
  SELECT COUNT(*) INTO v_count
  FROM moderation_violations
  WHERE user_id = v_user_id
    AND created_at > NOW() - INTERVAL '1 hour';

  -- Auto-ban if threshold exceeded
  IF v_count > v_threshold THEN
    UPDATE profiles
    SET banned_at = NOW(),
        ban_reason = 'Automatic 24-hour ban: exceeded moderation violation limit (' || v_count || ' violations in 1 hour)',
        updated_at = NOW()
    WHERE id = v_user_id
      AND banned_at IS NULL;

    v_is_banned := true;

    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (
      v_user_id,
      'moderation',
      'Account Temporarily Suspended',
      'Your account has been suspended for 24 hours due to repeated content policy violations.',
      jsonb_build_object(
        'action', 'auto_ban',
        'violation_count', v_count,
        'ban_duration_hours', 24
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'recorded', true,
    'violation_count', v_count,
    'threshold', v_threshold,
    'banned', v_is_banned
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_moderation_violation(TEXT, TEXT, TEXT[]) TO authenticated;

-- 3. Admin unban RPC
CREATE OR REPLACE FUNCTION public.admin_unban_user(target_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_tier TEXT;
  target_banned TIMESTAMPTZ;
BEGIN
  SELECT p.tier INTO caller_tier FROM profiles p WHERE p.id = auth.uid();
  IF caller_tier IS DISTINCT FROM 'developer' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Forbidden');
  END IF;

  SELECT p.banned_at INTO target_banned FROM profiles p WHERE p.id = target_user_id;
  IF target_banned IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'User is not banned');
  END IF;

  UPDATE profiles
  SET banned_at = NULL,
      ban_reason = NULL,
      updated_at = NOW()
  WHERE id = target_user_id;

  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (
    target_user_id,
    'moderation',
    'Account Unsuspended',
    'Your account suspension has been lifted. Please follow community guidelines to avoid future suspensions.',
    jsonb_build_object('action', 'unbanned', 'moderator_id', auth.uid()::text)
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_unban_user(UUID) TO authenticated;

-- 4. Admin ban RPC
CREATE OR REPLACE FUNCTION public.admin_ban_user(
  target_user_id UUID,
  p_reason TEXT DEFAULT 'Banned by administrator'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_tier TEXT;
  target_tier TEXT;
BEGIN
  SELECT p.tier INTO caller_tier FROM profiles p WHERE p.id = auth.uid();
  IF caller_tier IS DISTINCT FROM 'developer' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Forbidden');
  END IF;

  SELECT p.tier INTO target_tier FROM profiles p WHERE p.id = target_user_id;
  IF target_tier IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'User not found');
  END IF;
  IF target_tier = 'developer' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Cannot ban a developer account');
  END IF;

  UPDATE profiles
  SET banned_at = NOW(),
      ban_reason = p_reason,
      updated_at = NOW()
  WHERE id = target_user_id;

  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (
    target_user_id,
    'moderation',
    'Account Suspended',
    p_reason,
    jsonb_build_object('action', 'admin_ban', 'moderator_id', auth.uid()::text)
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_ban_user(UUID, TEXT) TO authenticated;

-- 5. Auto-expire 24h bans (cron every 15 min)
CREATE OR REPLACE FUNCTION public.expire_auto_bans()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE profiles
  SET banned_at = NULL,
      ban_reason = NULL,
      updated_at = NOW()
  WHERE banned_at IS NOT NULL
    AND banned_at < NOW() - INTERVAL '24 hours'
    AND ban_reason LIKE 'Automatic%';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

SELECT cron.schedule(
  'expire-auto-bans',
  '*/15 * * * *',
  $$SELECT public.expire_auto_bans()$$
);

-- 6. Cleanup old violation records (daily, 30 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_moderation_violations(days_old INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.moderation_violations
  WHERE created_at < NOW() - (days_old || ' days')::INTERVAL;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT cron.schedule(
  'cleanup-old-moderation-violations',
  '0 5 * * *',
  $$SELECT public.cleanup_old_moderation_violations(30)$$
);
