-- Fix: pgcrypto lives in the 'extensions' schema on Supabase.
-- Recreate PIN functions with extensions.crypt() / extensions.gen_salt().

-- ── set_admin_pin ───────────────────────────────────────────
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

  IF new_pin !~ '^\d{6}$' THEN
    RETURN jsonb_build_object('success', false, 'message', 'PIN must be exactly 6 digits');
  END IF;

  SELECT pin_hash, locked_until, attempts
  INTO v_existing
  FROM admin_pin_state
  WHERE user_id = auth.uid();

  IF v_existing.pin_hash IS NOT NULL THEN
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

    IF v_existing.pin_hash != extensions.crypt(old_pin, v_existing.pin_hash) THEN
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

    UPDATE admin_pin_state
    SET pin_hash           = extensions.crypt(new_pin, extensions.gen_salt('bf', 10)),
        attempts           = 0,
        locked_until       = NULL,
        session_expires_at = NULL,
        updated_at         = NOW()
    WHERE user_id = auth.uid();
  ELSE
    INSERT INTO admin_pin_state (user_id, pin_hash)
    VALUES (auth.uid(), extensions.crypt(new_pin, extensions.gen_salt('bf', 10)));
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_admin_pin(TEXT, TEXT) TO authenticated;

-- ── verify_admin_pin ────────────────────────────────────────
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

  IF v_state.locked_until IS NOT NULL AND v_state.locked_until > NOW() THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Too many failed attempts. Try again later.',
      'locked_until', v_state.locked_until,
      'remaining_seconds', EXTRACT(EPOCH FROM (v_state.locked_until - NOW()))::INT
    );
  END IF;

  IF v_state.pin_hash = extensions.crypt(pin, v_state.pin_hash) THEN
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
