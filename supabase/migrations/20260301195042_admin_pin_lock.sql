-- ============================================================
-- Admin PIN Lock: keypad authentication for the admin panel.
-- Even with a stolen JWT, admin RPCs cannot execute without
-- a valid PIN-authenticated session.
-- ============================================================

-- 1) Ensure pgcrypto is available for bcrypt hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2) Separate table for PIN state. RLS enabled with ZERO policies
--    means the Supabase client can never read/write this directly.
--    All access is through SECURITY DEFINER functions.
CREATE TABLE public.admin_pin_state (
  user_id            UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  pin_hash           TEXT NOT NULL,
  attempts           INTEGER NOT NULL DEFAULT 0,
  locked_until       TIMESTAMPTZ DEFAULT NULL,
  session_expires_at TIMESTAMPTZ DEFAULT NULL,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.admin_pin_state ENABLE ROW LEVEL SECURITY;
-- Intentionally NO policies. All access via SECURITY DEFINER RPCs only.

-- ============================================================
-- 3) Helper: require_admin_session()
--    Called at the top of every admin RPC. Checks developer tier
--    AND that a valid (non-expired) admin PIN session exists.
-- ============================================================
CREATE OR REPLACE FUNCTION public.require_admin_session()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier              TEXT;
  v_session_expires   TIMESTAMPTZ;
BEGIN
  -- Check developer tier
  SELECT p.tier INTO v_tier FROM profiles p WHERE p.id = auth.uid();
  IF v_tier IS DISTINCT FROM 'developer' THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  -- Check admin PIN session
  SELECT aps.session_expires_at INTO v_session_expires
  FROM admin_pin_state aps
  WHERE aps.user_id = auth.uid();

  IF v_session_expires IS NULL OR v_session_expires < NOW() THEN
    RAISE EXCEPTION 'Admin session expired. Please re-enter your PIN.';
  END IF;
END;
$$;

-- ============================================================
-- 4) has_admin_pin() — check if the caller has a PIN configured
-- ============================================================
CREATE OR REPLACE FUNCTION public.has_admin_pin()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier TEXT;
  v_has  BOOLEAN;
BEGIN
  SELECT p.tier INTO v_tier FROM profiles p WHERE p.id = auth.uid();
  IF v_tier IS DISTINCT FROM 'developer' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Forbidden');
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM admin_pin_state WHERE user_id = auth.uid()
  ) INTO v_has;

  RETURN jsonb_build_object('success', true, 'has_pin', v_has);
END;
$$;

GRANT EXECUTE ON FUNCTION public.has_admin_pin() TO authenticated;

-- ============================================================
-- 5) set_admin_pin(new_pin, old_pin) — create or change PIN
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_admin_pin(
  new_pin TEXT,
  old_pin TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier      TEXT;
  v_existing  RECORD;
BEGIN
  SELECT p.tier INTO v_tier FROM profiles p WHERE p.id = auth.uid();
  IF v_tier IS DISTINCT FROM 'developer' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Forbidden');
  END IF;

  -- Validate new PIN format: exactly 6 digits
  IF new_pin !~ '^\d{6}$' THEN
    RETURN jsonb_build_object('success', false, 'message', 'PIN must be exactly 6 digits');
  END IF;

  -- Check if PIN already exists
  SELECT pin_hash, locked_until, attempts
  INTO v_existing
  FROM admin_pin_state
  WHERE user_id = auth.uid();

  IF v_existing.pin_hash IS NOT NULL THEN
    -- Changing existing PIN: require old PIN
    IF v_existing.locked_until IS NOT NULL AND v_existing.locked_until > NOW() THEN
      RETURN jsonb_build_object(
        'success', false,
        'message', 'Too many failed attempts. Try again later.',
        'locked_until', v_existing.locked_until
      );
    END IF;

    IF old_pin IS NULL THEN
      RETURN jsonb_build_object('success', false, 'message', 'Current PIN required to change PIN');
    END IF;

    IF v_existing.pin_hash != crypt(old_pin, v_existing.pin_hash) THEN
      -- Wrong old PIN: increment attempts
      UPDATE admin_pin_state
      SET attempts = attempts + 1,
          locked_until = CASE
            WHEN attempts + 1 >= 5 THEN NOW() + INTERVAL '15 minutes'
            ELSE locked_until
          END,
          updated_at = NOW()
      WHERE user_id = auth.uid();

      RETURN jsonb_build_object('success', false, 'message', 'Incorrect current PIN');
    END IF;

    -- Old PIN correct: update to new PIN
    UPDATE admin_pin_state
    SET pin_hash           = crypt(new_pin, gen_salt('bf', 10)),
        attempts           = 0,
        locked_until       = NULL,
        session_expires_at = NULL,
        updated_at         = NOW()
    WHERE user_id = auth.uid();
  ELSE
    -- First-time setup: insert new PIN
    INSERT INTO admin_pin_state (user_id, pin_hash)
    VALUES (auth.uid(), crypt(new_pin, gen_salt('bf', 10)));
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_admin_pin(TEXT, TEXT) TO authenticated;

-- ============================================================
-- 6) verify_admin_pin(pin) — verify PIN and create 15-min session
-- ============================================================
CREATE OR REPLACE FUNCTION public.verify_admin_pin(pin TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier     TEXT;
  v_state    RECORD;
  v_remaining INT;
BEGIN
  SELECT p.tier INTO v_tier FROM profiles p WHERE p.id = auth.uid();
  IF v_tier IS DISTINCT FROM 'developer' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Forbidden');
  END IF;

  SELECT pin_hash, attempts, locked_until
  INTO v_state
  FROM admin_pin_state
  WHERE user_id = auth.uid();

  IF v_state.pin_hash IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'No PIN configured');
  END IF;

  -- Check lockout
  IF v_state.locked_until IS NOT NULL AND v_state.locked_until > NOW() THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Too many failed attempts. Try again later.',
      'locked_until', v_state.locked_until,
      'remaining_seconds', EXTRACT(EPOCH FROM (v_state.locked_until - NOW()))::INT
    );
  END IF;

  -- Verify PIN
  IF v_state.pin_hash = crypt(pin, v_state.pin_hash) THEN
    -- Success: create 15-minute session
    UPDATE admin_pin_state
    SET attempts           = 0,
        locked_until       = NULL,
        session_expires_at = NOW() + INTERVAL '15 minutes',
        updated_at         = NOW()
    WHERE user_id = auth.uid();

    RETURN jsonb_build_object(
      'success', true,
      'expires_at', (NOW() + INTERVAL '15 minutes')
    );
  ELSE
    -- Failure: increment attempts
    v_remaining := 5 - (v_state.attempts + 1);

    UPDATE admin_pin_state
    SET attempts = attempts + 1,
        locked_until = CASE
          WHEN attempts + 1 >= 5 THEN NOW() + INTERVAL '15 minutes'
          ELSE locked_until
        END,
        updated_at = NOW()
    WHERE user_id = auth.uid();

    IF v_remaining <= 0 THEN
      RETURN jsonb_build_object(
        'success', false,
        'message', 'Incorrect PIN. Account locked for 15 minutes.',
        'locked', true,
        'locked_until', (NOW() + INTERVAL '15 minutes')
      );
    ELSE
      RETURN jsonb_build_object(
        'success', false,
        'message', 'Incorrect PIN. ' || v_remaining || ' attempts remaining.',
        'attempts_remaining', v_remaining
      );
    END IF;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_admin_pin(TEXT) TO authenticated;

-- ============================================================
-- 7) extend_admin_session() — extend by 15 min if still active
-- ============================================================
CREATE OR REPLACE FUNCTION public.extend_admin_session()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier     TEXT;
  v_expires  TIMESTAMPTZ;
BEGIN
  SELECT p.tier INTO v_tier FROM profiles p WHERE p.id = auth.uid();
  IF v_tier IS DISTINCT FROM 'developer' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Forbidden');
  END IF;

  SELECT session_expires_at INTO v_expires
  FROM admin_pin_state
  WHERE user_id = auth.uid();

  IF v_expires IS NULL OR v_expires < NOW() THEN
    RETURN jsonb_build_object('success', false, 'message', 'Session expired');
  END IF;

  UPDATE admin_pin_state
  SET session_expires_at = NOW() + INTERVAL '15 minutes',
      updated_at         = NOW()
  WHERE user_id = auth.uid();

  RETURN jsonb_build_object(
    'success', true,
    'expires_at', (NOW() + INTERVAL '15 minutes')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.extend_admin_session() TO authenticated;


-- ============================================================
-- 8) Recreate all 14 admin RPCs to use require_admin_session()
--    instead of inline tier checks.
-- ============================================================

-- ── 8a) admin_search_users ──────────────────────────────────
DROP FUNCTION IF EXISTS public.admin_search_users(TEXT);
CREATE OR REPLACE FUNCTION public.admin_search_users(search_query TEXT)
RETURNS TABLE (
  id              UUID,
  display_name    TEXT,
  email           TEXT,
  avatar_url      TEXT,
  tier            TEXT,
  role            TEXT,
  role_team_name  TEXT,
  tier_expires_at TIMESTAMPTZ,
  banned_at       TIMESTAMPTZ,
  ban_reason      TEXT,
  created_at      TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM require_admin_session();

  RETURN QUERY
  SELECT p.id, p.display_name, p.email, p.avatar_url, p.tier, p.role,
         t.name AS role_team_name,
         p.tier_expires_at, p.banned_at, p.ban_reason, p.created_at
  FROM profiles p
  LEFT JOIN my_teams t ON t.id = p.role_team_id
  WHERE p.display_name ILIKE '%' || search_query || '%'
     OR p.id::text = search_query
  ORDER BY p.created_at DESC
  LIMIT 50;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_search_users(TEXT) TO authenticated;

-- ── 8b) admin_set_user_tier ─────────────────────────────────
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
  target_tier  TEXT;
  v_expires_at TIMESTAMPTZ;
BEGIN
  PERFORM require_admin_session();

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

-- ── 8c) admin_delete_user ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_delete_user(target_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_tier TEXT;
BEGIN
  PERFORM require_admin_session();

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

-- ── 8d) admin_remove_user_avatar ────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_remove_user_avatar(
  target_user_id UUID,
  moderation_message TEXT DEFAULT 'Your avatar has been removed for violating our guidelines.'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_tier      TEXT;
  v_cooldown_until TIMESTAMPTZ;
BEGIN
  PERFORM require_admin_session();

  SELECT p.tier INTO target_tier FROM profiles p WHERE p.id = target_user_id;
  IF target_tier IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'User not found');
  END IF;
  IF target_tier = 'developer' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Cannot moderate a developer account');
  END IF;

  v_cooldown_until := NOW() + INTERVAL '1 month';

  DELETE FROM storage.objects
  WHERE bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = target_user_id::text;

  UPDATE profiles
  SET avatar_url = NULL,
      avatar_moderated_until = v_cooldown_until,
      updated_at = NOW()
  WHERE id = target_user_id;

  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (
    target_user_id,
    'moderation',
    'Avatar Removed',
    moderation_message,
    jsonb_build_object(
      'action', 'avatar_removed',
      'cooldown_until', v_cooldown_until::text,
      'moderator_id', auth.uid()::text
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'cooldown_until', v_cooldown_until::text
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_remove_user_avatar(UUID, TEXT) TO authenticated;

-- ── 8e) admin_ban_user ──────────────────────────────────────
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
  target_tier TEXT;
BEGIN
  PERFORM require_admin_session();

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

-- ── 8f) admin_unban_user ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_unban_user(target_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_banned TIMESTAMPTZ;
BEGIN
  PERFORM require_admin_session();

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

-- ── 8g) admin_search_teams ──────────────────────────────────
DROP FUNCTION IF EXISTS public.admin_search_teams(TEXT);
CREATE OR REPLACE FUNCTION public.admin_search_teams(search_query TEXT)
RETURNS TABLE (
  id                    TEXT,
  name                  TEXT,
  owner_id              UUID,
  owner_display_name    TEXT,
  owner_avatar_url      TEXT,
  has_team_plan         BOOLEAN,
  team_plan_status      TEXT,
  team_max_enemy_teams  INTEGER,
  member_count          BIGINT,
  banned_at             TIMESTAMPTZ,
  ban_reason            TEXT,
  ban_expires_at        TIMESTAMPTZ,
  created_at            TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM require_admin_session();

  RETURN QUERY
  SELECT
    t.id,
    t.name,
    t.user_id        AS owner_id,
    p.display_name   AS owner_display_name,
    p.avatar_url     AS owner_avatar_url,
    t.has_team_plan,
    t.team_plan_status,
    t.team_max_enemy_teams,
    (SELECT COUNT(*) FROM team_members tm WHERE tm.team_id = t.id) AS member_count,
    t.banned_at,
    t.ban_reason,
    t.ban_expires_at,
    t.created_at
  FROM my_teams t
  JOIN profiles p ON p.id = t.user_id
  WHERE t.name ILIKE '%' || search_query || '%'
     OR t.id = search_query
  ORDER BY t.created_at DESC
  LIMIT 50;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_search_teams(TEXT) TO authenticated;

-- ── 8h) admin_set_team_plan ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_set_team_plan(
  target_team_id TEXT,
  enable         BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team RECORD;
BEGIN
  PERFORM require_admin_session();

  SELECT id, has_team_plan INTO v_team FROM my_teams WHERE id = target_team_id;
  IF v_team.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Team not found');
  END IF;

  IF enable THEN
    UPDATE my_teams
    SET has_team_plan        = TRUE,
        team_plan_status     = 'active',
        team_max_enemy_teams = 300,
        updated_at           = NOW()
    WHERE id = target_team_id;
  ELSE
    UPDATE my_teams
    SET has_team_plan        = FALSE,
        team_plan_status     = NULL,
        team_max_enemy_teams = 0,
        updated_at           = NOW()
    WHERE id = target_team_id;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_team_plan(TEXT, BOOLEAN) TO authenticated;

-- ── 8i) admin_rename_team ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_rename_team(
  target_team_id TEXT,
  new_name       TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team RECORD;
BEGIN
  PERFORM require_admin_session();

  SELECT id INTO v_team FROM my_teams WHERE id = target_team_id;
  IF v_team.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Team not found');
  END IF;

  IF TRIM(new_name) = '' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Name cannot be empty');
  END IF;

  UPDATE my_teams
  SET name = TRIM(new_name),
      updated_at = NOW()
  WHERE id = target_team_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_rename_team(TEXT, TEXT) TO authenticated;

-- ── 8j) admin_delete_team ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_delete_team(
  target_team_id TEXT,
  p_message      TEXT DEFAULT 'Your team has been removed by an administrator.'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team RECORD;
BEGIN
  PERFORM require_admin_session();

  SELECT id, name, user_id INTO v_team FROM my_teams WHERE id = target_team_id;
  IF v_team.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Team not found');
  END IF;

  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (
    v_team.user_id,
    'team_deleted',
    'Team Deleted: ' || v_team.name,
    COALESCE(NULLIF(TRIM(p_message), ''), 'Your team has been removed by an administrator.'),
    jsonb_build_object('action', 'admin_delete_team', 'team_name', v_team.name, 'moderator_id', auth.uid()::text)
  );

  DELETE FROM team_invites WHERE team_id = target_team_id;
  DELETE FROM team_members WHERE team_id = target_team_id;
  DELETE FROM players WHERE team_id = target_team_id;

  DELETE FROM enemy_players WHERE team_id IN (
    SELECT eid FROM (SELECT id AS eid FROM enemy_teams WHERE team_id = target_team_id) sub
  );
  DELETE FROM enemy_teams WHERE team_id = target_team_id;

  UPDATE draft_sessions SET my_team_id = NULL WHERE my_team_id = target_team_id;

  DELETE FROM my_teams WHERE id = target_team_id;

  RETURN jsonb_build_object('success', true, 'message', 'Team deleted: ' || v_team.name);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_team(TEXT, TEXT) TO authenticated;

-- ── 8k) admin_ban_team ──────────────────────────────────────
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
  v_team         RECORD;
  v_expires_at   TIMESTAMPTZ;
  v_title        TEXT;
  v_body         TEXT;
BEGIN
  PERFORM require_admin_session();

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

  IF v_expires_at IS NOT NULL THEN
    v_title := 'Team Suspended: ' || v_team.name;
    v_body  := COALESCE(NULLIF(TRIM(p_reason), ''), 'Banned by administrator')
               || ' (Expires in ' || ban_hours || ' hour'
               || CASE WHEN ban_hours > 1 THEN 's' ELSE '' END || ')';
  ELSE
    v_title := 'Team Banned: ' || v_team.name;
    v_body  := COALESCE(NULLIF(TRIM(p_reason), ''), 'Banned by administrator');
  END IF;

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

GRANT EXECUTE ON FUNCTION public.admin_ban_team(TEXT, TEXT, INTEGER) TO authenticated;

-- ── 8l) admin_unban_team ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_unban_team(
  target_team_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team RECORD;
BEGIN
  PERFORM require_admin_session();

  SELECT id, banned_at INTO v_team FROM my_teams WHERE id = target_team_id;
  IF v_team.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Team not found');
  END IF;

  IF v_team.banned_at IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Team is not banned');
  END IF;

  UPDATE my_teams
  SET banned_at      = NULL,
      ban_reason     = NULL,
      ban_expires_at = NULL,
      updated_at     = NOW()
  WHERE id = target_team_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_unban_team(TEXT) TO authenticated;

-- ── 8m) get_analytics_summary ───────────────────────────────
CREATE OR REPLACE FUNCTION public.get_analytics_summary(
  p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  p_end_date   TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result     JSONB;
  v_today      DATE := CURRENT_DATE;
  v_week_start DATE := CURRENT_DATE - INTERVAL '7 days';
  v_month_start DATE := CURRENT_DATE - INTERVAL '30 days';
BEGIN
  PERFORM require_admin_session();

  SELECT jsonb_build_object(
    'views_today', (
      SELECT COUNT(*) FROM page_views
      WHERE created_at >= v_today
    ),
    'views_week', (
      SELECT COUNT(*) FROM page_views
      WHERE created_at >= v_week_start
    ),
    'views_month', (
      SELECT COUNT(*) FROM page_views
      WHERE created_at >= v_month_start
    ),
    'unique_today', (
      SELECT COUNT(DISTINCT session_id) FROM page_views
      WHERE created_at >= v_today
    ),
    'unique_week', (
      SELECT COUNT(DISTINCT session_id) FROM page_views
      WHERE created_at >= v_week_start
    ),
    'unique_month', (
      SELECT COUNT(DISTINCT session_id) FROM page_views
      WHERE created_at >= v_month_start
    ),
    'top_pages', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
      FROM (
        SELECT page_url, COUNT(*) AS views,
               COUNT(DISTINCT session_id) AS unique_visitors
        FROM page_views
        WHERE created_at BETWEEN p_start_date AND p_end_date
        GROUP BY page_url
        ORDER BY views DESC
        LIMIT 15
      ) t
    ),
    'daily_views', (
      SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.day), '[]'::jsonb)
      FROM (
        SELECT DATE(created_at) AS day,
               COUNT(*) AS views,
               COUNT(DISTINCT session_id) AS unique_visitors
        FROM page_views
        WHERE created_at BETWEEN p_start_date AND p_end_date
        GROUP BY DATE(created_at)
        ORDER BY day
      ) t
    ),
    'devices', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
      FROM (
        SELECT COALESCE(device_type, 'unknown') AS device,
               COUNT(*) AS count
        FROM page_views
        WHERE created_at BETWEEN p_start_date AND p_end_date
        GROUP BY device_type
        ORDER BY count DESC
      ) t
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_analytics_summary(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- ── 8n) get_platform_stats ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_platform_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  PERFORM require_admin_session();

  SELECT jsonb_build_object(
    'total_users', (SELECT COUNT(*) FROM profiles),
    'users_by_tier', (
      SELECT COALESCE(jsonb_object_agg(tier, cnt), '{}'::jsonb)
      FROM (SELECT tier, COUNT(*) AS cnt FROM profiles GROUP BY tier) t
    ),
    'new_users_week', (
      SELECT COUNT(*) FROM profiles WHERE created_at >= NOW() - INTERVAL '7 days'
    ),
    'new_users_month', (
      SELECT COUNT(*) FROM profiles WHERE created_at >= NOW() - INTERVAL '30 days'
    ),
    'banned_users', (
      SELECT COUNT(*) FROM profiles WHERE banned_at IS NOT NULL
    ),
    'total_teams', (SELECT COUNT(*) FROM my_teams),
    'teams_with_plan', (
      SELECT COUNT(*) FROM my_teams WHERE has_team_plan = TRUE
    ),
    'total_team_members', (SELECT COUNT(*) FROM team_members),
    'banned_teams', (
      SELECT COUNT(*) FROM my_teams WHERE banned_at IS NOT NULL
    ),
    'total_drafts', (SELECT COUNT(*) FROM draft_sessions),
    'active_drafts', (
      SELECT COUNT(*) FROM draft_sessions WHERE archived_at IS NULL
    ),
    'archived_drafts', (
      SELECT COUNT(*) FROM draft_sessions WHERE archived_at IS NOT NULL
    ),
    'favorite_drafts', (
      SELECT COUNT(*) FROM draft_sessions WHERE is_favorite = TRUE
    ),
    'total_live_drafts', (SELECT COUNT(*) FROM live_draft_sessions),
    'live_drafts_by_status', (
      SELECT COALESCE(jsonb_object_agg(status, cnt), '{}'::jsonb)
      FROM (SELECT status, COUNT(*) AS cnt FROM live_draft_sessions GROUP BY status) t
    ),
    'live_draft_modes', (
      SELECT COALESCE(jsonb_object_agg(draft_mode, cnt), '{}'::jsonb)
      FROM (SELECT draft_mode, COUNT(*) AS cnt FROM live_draft_sessions GROUP BY draft_mode) t
    ),
    'total_games', (SELECT COUNT(*) FROM live_draft_games),
    'completed_games', (
      SELECT COUNT(*) FROM live_draft_games WHERE status = 'completed'
    ),
    'drafts_by_users', (
      SELECT COUNT(*) FROM live_draft_sessions WHERE created_by IS NOT NULL
    ),
    'drafts_by_anon', (
      SELECT COUNT(*) FROM live_draft_sessions WHERE created_by IS NULL
    ),
    'game_formats', (
      SELECT COALESCE(jsonb_object_agg(label, cnt), '{}'::jsonb)
      FROM (
        SELECT 'Bo' || planned_games AS label, COUNT(*) AS cnt
        FROM live_draft_sessions
        GROUP BY planned_games
        ORDER BY planned_games
      ) t
    ),
    'total_friendships', (
      SELECT COUNT(*) FROM friendships WHERE status = 'accepted'
    ),
    'total_shares', (SELECT COUNT(*) FROM draft_shares),
    'total_share_views', (
      SELECT COALESCE(SUM(view_count), 0) FROM draft_shares
    ),
    'active_subscriptions', (
      SELECT COUNT(*) FROM subscriptions WHERE status = 'active'
    ),
    'subscriptions_by_tier', (
      SELECT COALESCE(jsonb_object_agg(tier, cnt), '{}'::jsonb)
      FROM (SELECT tier, COUNT(*) AS cnt FROM subscriptions WHERE status = 'active' GROUP BY tier) t
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_platform_stats() TO authenticated;
