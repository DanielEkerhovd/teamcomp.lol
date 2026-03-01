-- Avatar moderation status on profiles (one-time check result, never re-check)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_moderation_status TEXT DEFAULT NULL
    CHECK (avatar_moderation_status IN ('approved', 'rejected'));

-- Avatar change log for progressive cooldown spam filter
CREATE TABLE public.avatar_change_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_avatar_change_log_user_recent
  ON public.avatar_change_log (user_id, created_at DESC);

ALTER TABLE public.avatar_change_log ENABLE ROW LEVEL SECURITY;
-- No direct RLS policies — only SECURITY DEFINER RPCs access this table

-- ============================================================
-- RPC: check if the current user is allowed to change avatar
-- Progressive cooldown: 0 → 5min → 15min → 1hr → locked 24h
-- Returns { allowed, wait_seconds, change_count }
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_avatar_change_allowed()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_count   INTEGER;
  v_latest  TIMESTAMPTZ;
  v_wait    INTEGER := 0;
  v_now     TIMESTAMPTZ := NOW();
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'wait_seconds', 0, 'change_count', 0);
  END IF;

  -- Developers are exempt
  IF EXISTS (SELECT 1 FROM profiles WHERE id = v_user_id AND tier = 'developer') THEN
    RETURN jsonb_build_object('allowed', true, 'wait_seconds', 0, 'change_count', 0);
  END IF;

  -- Count changes in the last 24 hours
  SELECT COUNT(*), MAX(created_at)
  INTO v_count, v_latest
  FROM avatar_change_log
  WHERE user_id = v_user_id
    AND created_at > v_now - INTERVAL '24 hours';

  -- Progressive cooldown based on change count in the window
  IF v_count = 0 THEN
    v_wait := 0;
  ELSIF v_count = 1 THEN
    v_wait := 5 * 60;       -- 5 minutes
  ELSIF v_count = 2 THEN
    v_wait := 15 * 60;      -- 15 minutes
  ELSIF v_count = 3 THEN
    v_wait := 60 * 60;      -- 1 hour
  ELSE
    v_wait := 24 * 60 * 60; -- locked for 24 hours
  END IF;

  -- Check if enough time has elapsed since the last change
  IF v_latest IS NOT NULL AND v_wait > 0 THEN
    IF v_now < v_latest + (v_wait || ' seconds')::INTERVAL THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'wait_seconds', EXTRACT(EPOCH FROM (v_latest + (v_wait || ' seconds')::INTERVAL - v_now))::INTEGER,
        'change_count', v_count
      );
    END IF;
  END IF;

  RETURN jsonb_build_object('allowed', true, 'wait_seconds', 0, 'change_count', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_avatar_change_allowed() TO authenticated;

-- ============================================================
-- RPC: record an avatar change (called after successful upload)
-- ============================================================
CREATE OR REPLACE FUNCTION public.record_avatar_change()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO avatar_change_log (user_id) VALUES (auth.uid());
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_avatar_change() TO authenticated;

-- ============================================================
-- Cron: clean up avatar change log entries older than 48 hours
-- ============================================================
CREATE OR REPLACE FUNCTION public.cleanup_old_avatar_changes(hours_old INTEGER DEFAULT 48)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.avatar_change_log
  WHERE created_at < NOW() - (hours_old || ' hours')::INTERVAL;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT cron.schedule(
  'cleanup-old-avatar-changes',
  '0 6 * * *',
  $$SELECT public.cleanup_old_avatar_changes(48)$$
);
