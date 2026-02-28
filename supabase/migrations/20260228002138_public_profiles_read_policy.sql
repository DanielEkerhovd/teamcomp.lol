-- Allow anyone to read profiles (avatar_url, display_name, etc.)
-- The existing "Users can view own profile" policy only allows auth.uid() = id,
-- which blocks profile joins on other users' data (e.g. chat avatars, participant lists).

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

CREATE POLICY "Anyone can view profiles" ON public.profiles
  FOR SELECT USING (true);
