-- 1) Admin/Developer: use 99999 instead of 2147483647 for cleaner "unlimited"
UPDATE public.profiles
SET max_teams = 99999,
    max_enemy_teams = 99999,
    max_drafts = 99999
WHERE tier IN ('admin', 'developer');

-- 2) Update the tier limits trigger to use new admin values
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
        NEW.max_teams := 99999;
        NEW.max_enemy_teams := 99999;
        NEW.max_drafts := 99999;
      ELSE
        NULL;
    END CASE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3) Add team_max_drafts column to my_teams (default 0, 3000 for paid teams)
ALTER TABLE public.my_teams
  ADD COLUMN IF NOT EXISTS team_max_drafts INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.my_teams.team_max_drafts IS '0 for free teams, 3000 for paid teams';

UPDATE public.my_teams
SET team_max_drafts = 3000
WHERE has_team_plan = TRUE;

-- 4) Update check_draft_limit() to enforce team draft cap
CREATE OR REPLACE FUNCTION public.check_draft_limit()
RETURNS TRIGGER AS $$
DECLARE
  draft_count INTEGER;
  max_allowed INTEGER;
  team_draft_count INTEGER;
  team_draft_max INTEGER;
BEGIN
  -- Allow updates to existing drafts (upsert case)
  IF EXISTS (SELECT 1 FROM public.draft_sessions WHERE id = NEW.id) THEN
    RETURN NEW;
  END IF;

  -- If this draft is for a team with an active team plan, check team draft limit
  IF NEW.my_team_id IS NOT NULL THEN
    SELECT team_max_drafts INTO team_draft_max
    FROM public.my_teams
    WHERE id = NEW.my_team_id AND has_team_plan = TRUE;

    IF team_draft_max IS NOT NULL THEN
      -- Count drafts for this team
      SELECT COUNT(*) INTO team_draft_count
      FROM public.draft_sessions
      WHERE my_team_id = NEW.my_team_id;

      IF team_draft_count >= team_draft_max THEN
        RAISE EXCEPTION 'Team draft limit reached (% of %)', team_draft_count, team_draft_max;
      END IF;

      RETURN NEW;  -- Team plan draft within limit, skip personal check
    END IF;
  END IF;

  -- Count personal drafts (exclude drafts linked to paid teams)
  SELECT COUNT(*) INTO draft_count
  FROM public.draft_sessions ds
  WHERE ds.user_id = NEW.user_id
    AND (ds.my_team_id IS NULL
         OR NOT EXISTS (
           SELECT 1 FROM public.my_teams mt
           WHERE mt.id = ds.my_team_id AND mt.has_team_plan = TRUE
         ));

  -- Get user's max allowed drafts
  SELECT max_drafts INTO max_allowed
  FROM public.profiles
  WHERE id = NEW.user_id;

  IF draft_count >= COALESCE(max_allowed, 20) THEN
    RAISE EXCEPTION 'Draft limit reached (% of %)', draft_count, COALESCE(max_allowed, 20);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5) Update admin_set_team_plan to also set team_max_drafts
CREATE OR REPLACE FUNCTION public.admin_set_team_plan(
  target_team_id TEXT,
  enable         BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team RECORD;
BEGIN
  PERFORM require_admin_session();

  SELECT id, has_team_plan INTO v_team FROM my_teams WHERE id = target_team_id;
  IF v_team.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Team not found');
  END IF;

  IF enable THEN
    UPDATE my_teams
    SET has_team_plan        = TRUE,
        team_plan_status     = 'active',
        team_max_enemy_teams = 300,
        team_max_drafts      = 3000,
        updated_at           = NOW()
    WHERE id = target_team_id;
  ELSE
    UPDATE my_teams
    SET has_team_plan        = FALSE,
        team_plan_status     = NULL,
        team_max_enemy_teams = 0,
        team_max_drafts      = 0,
        updated_at           = NOW()
    WHERE id = target_team_id;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;
