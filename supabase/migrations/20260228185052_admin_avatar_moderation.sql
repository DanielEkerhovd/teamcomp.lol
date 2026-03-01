-- Admin avatar moderation: cooldown column, RPC function, storage policy update

-- 1) Add avatar_moderated_until column to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_moderated_until TIMESTAMPTZ DEFAULT NULL;

-- 2) admin_remove_user_avatar – removes avatar, sets cooldown, sends notification
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
  caller_tier TEXT;
  target_tier TEXT;
  v_cooldown_until TIMESTAMPTZ;
BEGIN
  -- Only developers may call this
  SELECT p.tier INTO caller_tier FROM profiles p WHERE p.id = auth.uid();
  IF caller_tier IS DISTINCT FROM 'developer' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Forbidden');
  END IF;

  -- Verify target exists
  SELECT p.tier INTO target_tier FROM profiles p WHERE p.id = target_user_id;
  IF target_tier IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'User not found');
  END IF;

  -- Cannot moderate developers
  IF target_tier = 'developer' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Cannot moderate a developer account');
  END IF;

  -- Set cooldown to 1 month from now
  v_cooldown_until := NOW() + INTERVAL '1 month';

  -- Remove avatar files from storage
  DELETE FROM storage.objects
  WHERE bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = target_user_id::text;

  -- Clear avatar URL and set cooldown
  UPDATE profiles
  SET avatar_url = NULL,
      avatar_moderated_until = v_cooldown_until,
      updated_at = NOW()
  WHERE id = target_user_id;

  -- Send notification to the user
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

-- 3) Update storage upload policy to also check avatar moderation cooldown
DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;

CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND tier != 'free'
    AND (avatar_moderated_until IS NULL OR avatar_moderated_until < NOW())
  )
);

-- Also update the UPDATE policy
DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;

CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND tier != 'free'
    AND (avatar_moderated_until IS NULL OR avatar_moderated_until < NOW())
  )
);
