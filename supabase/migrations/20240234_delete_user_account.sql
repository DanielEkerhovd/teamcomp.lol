-- NOTE: This RPC function is deprecated. Account deletion is now handled by the
-- delete-account Edge Function which has proper service role permissions.
-- This function is kept for backwards compatibility but will not delete the auth user.

-- Function to delete user data (not the auth user itself)
-- The actual account deletion is handled by the delete-account Edge Function
CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID;
BEGIN
  -- Get the current user's ID
  current_user_id := auth.uid();

  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Delete user's avatar from storage (files in avatars bucket)
  DELETE FROM storage.objects
  WHERE bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = current_user_id::text;

  -- Delete all user data (cascades will handle related records)
  -- The profiles table has ON DELETE CASCADE for most related tables
  DELETE FROM public.profiles WHERE id = current_user_id;

  -- NOTE: Auth user deletion is now handled by the delete-account Edge Function
  -- which uses the admin API with service role permissions
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.delete_user_account() TO authenticated;
