-- Add max_enemy_teams column to profiles (free tier default: 10)
ALTER TABLE public.profiles
  ADD COLUMN max_enemy_teams INTEGER DEFAULT 10;

UPDATE public.profiles
SET max_enemy_teams = 10
WHERE max_enemy_teams IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN max_enemy_teams SET NOT NULL,
  ALTER COLUMN max_enemy_teams SET DEFAULT 10;

-- Server-side enforcement: prevent inserts beyond the limit
CREATE OR REPLACE FUNCTION public.check_enemy_team_limit()
RETURNS TRIGGER AS $$
DECLARE
  team_count INTEGER;
  max_allowed INTEGER;
BEGIN
  -- Allow updates to existing teams (upsert case)
  IF EXISTS (SELECT 1 FROM public.enemy_teams WHERE id = NEW.id) THEN
    RETURN NEW;
  END IF;

  -- Count existing enemy teams for this user
  SELECT COUNT(*) INTO team_count
  FROM public.enemy_teams
  WHERE user_id = NEW.user_id;

  -- Get user's max allowed enemy teams
  SELECT max_enemy_teams INTO max_allowed
  FROM public.profiles
  WHERE id = NEW.user_id;

  IF team_count >= COALESCE(max_allowed, 10) THEN
    RAISE EXCEPTION 'Enemy team limit reached. Upgrade to create more enemy teams.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_enemy_team_limit
  BEFORE INSERT ON public.enemy_teams
  FOR EACH ROW EXECUTE FUNCTION public.check_enemy_team_limit();
