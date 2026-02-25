-- Add max_teams column to profiles if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name = 'max_teams'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN max_teams INTEGER DEFAULT 1;
  END IF;
END $$;

-- Ensure all existing profiles have max_teams set (default to 1 for free tier)
UPDATE public.profiles
SET max_teams = 1
WHERE max_teams IS NULL;

-- Add NOT NULL constraint after setting defaults
ALTER TABLE public.profiles
ALTER COLUMN max_teams SET DEFAULT 1;
