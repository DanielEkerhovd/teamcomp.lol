-- Paid/Supporter: 3 teams, 30 enemy teams, 1000 drafts
UPDATE public.profiles
SET max_enemy_teams = 30
WHERE tier IN ('paid', 'supporter');

-- Admin: same as developer (unlimited)
UPDATE public.profiles
SET max_teams = 2147483647,
    max_enemy_teams = 2147483647,
    max_drafts = 2147483647
WHERE tier = 'admin';
