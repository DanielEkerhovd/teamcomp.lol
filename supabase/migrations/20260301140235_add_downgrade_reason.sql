-- Add downgrade_reason to track WHY a user was downgraded
-- ('payment_failed' vs 'canceled') so the UI can show appropriate messaging.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS downgrade_reason TEXT DEFAULT NULL;

-- Update apply_tier_limits() to also clear downgrade_reason when upgrading
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
        -- (downgrade_reason is set by the webhook, not the trigger)
        IF OLD.tier IN ('beta', 'paid', 'supporter') THEN
          NEW.downgraded_at := NOW();
        END IF;
      WHEN 'beta' THEN
        NEW.max_teams := 3;
        NEW.max_enemy_teams := 30;
        NEW.max_drafts := 300;
        NEW.downgraded_at := NULL;
        NEW.downgrade_reason := NULL;
      WHEN 'paid' THEN
        NEW.max_teams := 3;
        NEW.max_enemy_teams := 30;
        NEW.max_drafts := 300;
        NEW.downgraded_at := NULL;
        NEW.downgrade_reason := NULL;
      WHEN 'supporter' THEN
        NEW.max_teams := 3;
        NEW.max_enemy_teams := 30;
        NEW.max_drafts := 300;
        NEW.downgraded_at := NULL;
        NEW.downgrade_reason := NULL;
      WHEN 'admin', 'developer' THEN
        NEW.max_teams := 2147483647;
        NEW.max_enemy_teams := 2147483647;
        NEW.max_drafts := 2147483647;
        NEW.downgraded_at := NULL;
        NEW.downgrade_reason := NULL;
      ELSE
        NULL;
    END CASE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
