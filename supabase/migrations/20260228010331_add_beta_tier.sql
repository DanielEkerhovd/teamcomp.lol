-- Add 'beta' to the allowed tier values
ALTER TABLE public.profiles DROP CONSTRAINT profiles_tier_check;

ALTER TABLE public.profiles ADD CONSTRAINT profiles_tier_check
  CHECK (tier IN ('free', 'beta', 'paid', 'supporter', 'admin', 'developer'));

-- Update developer tier to have maximum limits
UPDATE public.profiles
SET max_teams = 2147483647,
    max_enemy_teams = 2147483647,
    max_drafts = 2147483647
WHERE tier = 'developer';
