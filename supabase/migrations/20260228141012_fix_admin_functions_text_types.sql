-- Fix: recreate admin functions using TEXT instead of public.user_tier (which doesn't exist).
-- The tier column is TEXT with a CHECK constraint, not an enum.

-- Drop any old versions (may not exist if original migration failed)
DROP FUNCTION IF EXISTS public.admin_search_users(TEXT);
DROP FUNCTION IF EXISTS public.admin_set_user_tier(UUID, TEXT, INT);
DROP FUNCTION IF EXISTS public.admin_delete_user(UUID);
DROP FUNCTION IF EXISTS public.revert_expired_tiers();

-- Also ensure columns exist (idempotent, in case the ALTER TABLE from the previous migration failed)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tier_expires_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS banned_at       TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ban_reason      TEXT        DEFAULT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- admin_search_users
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_search_users(search_query TEXT)
RETURNS TABLE (
  id              UUID,
  display_name    TEXT,
  email           TEXT,
  tier            TEXT,
  tier_expires_at TIMESTAMPTZ,
  banned_at       TIMESTAMPTZ,
  ban_reason      TEXT,
  created_at      TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_tier TEXT;
BEGIN
  SELECT p.tier INTO caller_tier FROM profiles p WHERE p.id = auth.uid();
  IF caller_tier IS DISTINCT FROM 'developer' THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  SELECT p.id, p.display_name, p.email, p.tier, p.tier_expires_at,
         p.banned_at, p.ban_reason, p.created_at
  FROM profiles p
  WHERE p.display_name ILIKE '%' || search_query || '%'
     OR p.id::text = search_query
  ORDER BY p.created_at DESC
  LIMIT 50;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_search_users(TEXT) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- admin_set_user_tier
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_set_user_tier(
  target_user_id UUID,
  new_tier       TEXT,
  expires_in_hours INT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_tier  TEXT;
  target_tier  TEXT;
  v_expires_at TIMESTAMPTZ;
BEGIN
  SELECT p.tier INTO caller_tier FROM profiles p WHERE p.id = auth.uid();
  IF caller_tier IS DISTINCT FROM 'developer' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Forbidden');
  END IF;

  IF new_tier NOT IN ('free', 'beta', 'paid', 'supporter', 'admin', 'developer') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid tier value');
  END IF;

  SELECT p.tier INTO target_tier FROM profiles p WHERE p.id = target_user_id;
  IF target_tier IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'User not found');
  END IF;
  IF target_tier = 'developer' AND target_user_id <> auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'message', 'Cannot modify another developer');
  END IF;

  IF expires_in_hours IS NOT NULL AND expires_in_hours > 0 THEN
    v_expires_at := NOW() + (expires_in_hours || ' hours')::INTERVAL;
  ELSE
    v_expires_at := NULL;
  END IF;

  UPDATE profiles
  SET tier = new_tier,
      tier_expires_at = v_expires_at,
      updated_at = NOW()
  WHERE id = target_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_user_tier(UUID, TEXT, INT) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- admin_delete_user
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_delete_user(target_user_id UUID)
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
    RETURN jsonb_build_object('success', false, 'message', 'Cannot delete a developer account');
  END IF;

  DELETE FROM storage.objects
  WHERE bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = target_user_id::text;

  DELETE FROM profiles WHERE id = target_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_user(UUID) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- revert_expired_tiers (cron)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.revert_expired_tiers()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE profiles
  SET tier = 'free',
      tier_expires_at = NULL,
      updated_at = NOW()
  WHERE tier_expires_at IS NOT NULL
    AND tier_expires_at < NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Schedule cron (ignore error if already scheduled from previous migration)
DO $$
BEGIN
  PERFORM cron.schedule(
    'revert-expired-tiers',
    '*/15 * * * *',
    'SELECT public.revert_expired_tiers()'
  );
EXCEPTION WHEN OTHERS THEN
  -- already scheduled, update it
  PERFORM cron.alter_job(
    (SELECT jobid FROM cron.job WHERE jobname = 'revert-expired-tiers'),
    schedule := '*/15 * * * *',
    command := 'SELECT public.revert_expired_tiers()'
  );
END;
$$;
