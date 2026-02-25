-- Migration: Make username uniqueness case-insensitive
-- This prevents "John" and "john" from being different usernames

-- Drop the existing case-sensitive unique index
DROP INDEX IF EXISTS idx_profiles_display_name_unique;

-- Create a case-insensitive unique index using LOWER()
CREATE UNIQUE INDEX idx_profiles_display_name_unique
  ON public.profiles (LOWER(display_name))
  WHERE display_name IS NOT NULL;
