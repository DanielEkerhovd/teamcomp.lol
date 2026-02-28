-- Add max_drafts column to profiles (free tier default: 20)
ALTER TABLE public.profiles
  ADD COLUMN max_drafts INTEGER DEFAULT 20;

UPDATE public.profiles
SET max_drafts = 20
WHERE max_drafts IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN max_drafts SET NOT NULL,
  ALTER COLUMN max_drafts SET DEFAULT 20;

-- Set pro tier limits for existing paid/supporter/admin/developer users
-- Pro: 10 teams, 50 enemy teams, 1000 drafts
UPDATE public.profiles
SET max_teams = 10,
    max_enemy_teams = 50,
    max_drafts = 1000
WHERE tier IN ('paid', 'supporter', 'admin', 'developer');

-- Server-side enforcement: prevent draft inserts beyond the limit
CREATE OR REPLACE FUNCTION public.check_draft_limit()
RETURNS TRIGGER AS $$
DECLARE
  draft_count INTEGER;
  max_allowed INTEGER;
BEGIN
  -- Allow updates to existing drafts (upsert case)
  IF EXISTS (SELECT 1 FROM public.draft_sessions WHERE id = NEW.id) THEN
    RETURN NEW;
  END IF;

  -- Count existing drafts for this user
  SELECT COUNT(*) INTO draft_count
  FROM public.draft_sessions
  WHERE user_id = NEW.user_id;

  -- Get user's max allowed drafts
  SELECT max_drafts INTO max_allowed
  FROM public.profiles
  WHERE id = NEW.user_id;

  IF draft_count >= COALESCE(max_allowed, 20) THEN
    RAISE EXCEPTION 'Draft limit reached. Upgrade to create more drafts.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_draft_limit
  BEFORE INSERT ON public.draft_sessions
  FOR EACH ROW EXECUTE FUNCTION public.check_draft_limit();
