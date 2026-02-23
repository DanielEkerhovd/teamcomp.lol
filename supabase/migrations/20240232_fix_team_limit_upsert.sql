-- Fix team limit trigger to allow upserts of existing teams
-- The previous trigger fired on all INSERTs, including upserts that update existing teams

CREATE OR REPLACE FUNCTION public.check_team_limit()
RETURNS TRIGGER AS $$
DECLARE
  team_count INTEGER;
  max_allowed INTEGER;
BEGIN
  -- Check if this team already exists (upsert case)
  -- If it exists, this is an update, not a new team - allow it
  IF EXISTS (SELECT 1 FROM public.my_teams WHERE id = NEW.id) THEN
    RETURN NEW;
  END IF;

  -- Count existing teams for this user
  SELECT COUNT(*) INTO team_count
  FROM public.my_teams
  WHERE user_id = NEW.user_id;

  -- Get user's max allowed teams
  SELECT max_teams INTO max_allowed
  FROM public.profiles
  WHERE id = NEW.user_id;

  -- Only block if this would exceed the limit
  IF team_count >= COALESCE(max_allowed, 1) THEN
    RAISE EXCEPTION 'Team limit reached. Upgrade to create more teams.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
