-- Reduce pro tier max_teams from 10 to 3
UPDATE public.profiles
SET max_teams = 3
WHERE tier IN ('paid', 'supporter', 'admin')
  AND max_teams = 10;
