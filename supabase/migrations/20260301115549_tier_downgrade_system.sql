-- Tier Downgrade Content Selection System
-- When a user's subscription is canceled, they must choose which content to keep
-- within free tier limits. Unselected content is archived for 7 days before deletion.

-- =============================================================================
-- 1) Add downgraded_at to profiles
-- =============================================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS downgraded_at TIMESTAMPTZ DEFAULT NULL;

-- =============================================================================
-- 2) Add archived_at to content tables
-- =============================================================================
ALTER TABLE public.my_teams
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE public.enemy_teams
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE public.draft_sessions
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NULL;

-- =============================================================================
-- 3) Update apply_tier_limits() trigger to set/clear downgraded_at
-- =============================================================================
CREATE OR REPLACE FUNCTION public.apply_tier_limits()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tier IS DISTINCT FROM OLD.tier THEN
    CASE NEW.tier
      WHEN 'free' THEN
        NEW.max_teams := 1;
        NEW.max_enemy_teams := 10;
        NEW.max_drafts := 20;
        -- Set downgraded_at if coming from a paid tier
        IF OLD.tier IN ('beta', 'paid', 'supporter') THEN
          NEW.downgraded_at := NOW();
        END IF;
      WHEN 'beta' THEN
        NEW.max_teams := 3;
        NEW.max_enemy_teams := 30;
        NEW.max_drafts := 300;
        NEW.downgraded_at := NULL;
      WHEN 'paid' THEN
        NEW.max_teams := 3;
        NEW.max_enemy_teams := 30;
        NEW.max_drafts := 300;
        NEW.downgraded_at := NULL;
      WHEN 'supporter' THEN
        NEW.max_teams := 3;
        NEW.max_enemy_teams := 30;
        NEW.max_drafts := 300;
        NEW.downgraded_at := NULL;
      WHEN 'admin', 'developer' THEN
        NEW.max_teams := 2147483647;
        NEW.max_enemy_teams := 2147483647;
        NEW.max_drafts := 2147483647;
        NEW.downgraded_at := NULL;
      ELSE
        NULL;
    END CASE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 4) Function to unarchive all user content (called on resubscribe)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.unarchive_user_content(p_user_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.my_teams SET archived_at = NULL WHERE user_id = p_user_id AND archived_at IS NOT NULL;
  UPDATE public.enemy_teams SET archived_at = NULL WHERE user_id = p_user_id AND archived_at IS NOT NULL;
  UPDATE public.draft_sessions SET archived_at = NULL WHERE user_id = p_user_id AND archived_at IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 5) Cron job to permanently delete archived content older than 7 days
-- =============================================================================
CREATE OR REPLACE FUNCTION public.cleanup_archived_content()
RETURNS void AS $$
BEGIN
  -- Delete players for archived my_teams first (before FK constraint)
  DELETE FROM public.players WHERE team_id IN (
    SELECT id FROM public.my_teams WHERE archived_at < NOW() - INTERVAL '7 days'
  );
  -- Delete enemy_players for archived enemy_teams
  DELETE FROM public.enemy_players WHERE team_id IN (
    SELECT id FROM public.enemy_teams WHERE archived_at < NOW() - INTERVAL '7 days'
  );
  -- Delete draft shares for archived drafts
  DELETE FROM public.draft_shares WHERE draft_session_id IN (
    SELECT id FROM public.draft_sessions WHERE archived_at < NOW() - INTERVAL '7 days'
  );
  -- Delete team_members for archived teams
  DELETE FROM public.team_members WHERE team_id IN (
    SELECT id FROM public.my_teams WHERE archived_at < NOW() - INTERVAL '7 days'
  );
  -- Delete team_invites for archived teams
  DELETE FROM public.team_invites WHERE team_id IN (
    SELECT id FROM public.my_teams WHERE archived_at < NOW() - INTERVAL '7 days'
  );
  -- Now delete the archived content itself
  DELETE FROM public.my_teams WHERE archived_at < NOW() - INTERVAL '7 days';
  DELETE FROM public.enemy_teams WHERE archived_at < NOW() - INTERVAL '7 days';
  DELETE FROM public.draft_sessions WHERE archived_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule cleanup to run every 15 minutes (same cadence as revert_expired_tiers)
SELECT cron.schedule(
  'cleanup-archived-content',
  '*/15 * * * *',
  $$SELECT public.cleanup_archived_content()$$
);
