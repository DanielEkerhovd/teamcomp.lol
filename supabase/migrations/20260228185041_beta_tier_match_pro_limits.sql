-- Update beta tier limits to match pro/supporter

-- Update existing beta users
UPDATE public.profiles
SET max_enemy_teams = 30, max_drafts = 300
WHERE tier = 'beta';

-- Update the tier limits trigger
CREATE OR REPLACE FUNCTION public.apply_tier_limits()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tier IS DISTINCT FROM OLD.tier THEN
    CASE NEW.tier
      WHEN 'free' THEN
        NEW.max_teams := 1;
        NEW.max_enemy_teams := 10;
        NEW.max_drafts := 20;
      WHEN 'beta' THEN
        NEW.max_teams := 3;
        NEW.max_enemy_teams := 30;
        NEW.max_drafts := 300;
      WHEN 'paid' THEN
        NEW.max_teams := 3;
        NEW.max_enemy_teams := 30;
        NEW.max_drafts := 300;
      WHEN 'supporter' THEN
        NEW.max_teams := 3;
        NEW.max_enemy_teams := 30;
        NEW.max_drafts := 300;
      WHEN 'admin', 'developer' THEN
        NEW.max_teams := 2147483647;
        NEW.max_enemy_teams := 2147483647;
        NEW.max_drafts := 2147483647;
      ELSE
        NULL;
    END CASE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
