-- Migration: Require username setup on account creation
-- Instead of auto-generating display_name from Discord/email, set it to NULL
-- so users must choose their own unique username

-- Update the handle_new_user function to not auto-set display_name
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    NULL  -- User must set their own username
  );

  INSERT INTO public.user_settings (user_id)
  VALUES (NEW.id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add unique constraint on display_name (excluding NULLs)
-- This ensures no two users can have the same username
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_display_name_unique
  ON public.profiles (display_name)
  WHERE display_name IS NOT NULL;
