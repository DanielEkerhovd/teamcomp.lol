-- Repair migration: re-apply stripe tables and team name fix
-- The stripe migration (20260228151035) failed mid-way due to uuid_generate_v4()
-- and the team name fix (20260228152440) was never actually applied,
-- even though both were marked as applied in the migration history.

-- 1. Subscriptions table (idempotent)
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT NOT NULL UNIQUE,
  stripe_customer_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'trialing', 'unpaid', 'paused')),
  price_id TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('paid', 'supporter')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_sub_id ON public.subscriptions(stripe_subscription_id);

-- 2. Donations table (idempotent)
CREATE TABLE IF NOT EXISTS public.donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  stripe_payment_intent_id TEXT UNIQUE,
  stripe_checkout_session_id TEXT,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'eur',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'succeeded', 'failed')),
  donor_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_donations_user_id ON public.donations(user_id);

-- 3. RLS policies (idempotent)
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own subscriptions' AND tablename = 'subscriptions') THEN
    CREATE POLICY "Users can view own subscriptions"
      ON public.subscriptions FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own donations' AND tablename = 'donations') THEN
    CREATE POLICY "Users can view own donations"
      ON public.donations FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- 4. Trigger: auto-set tier limits when tier changes (CREATE OR REPLACE is idempotent)
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
        NEW.max_enemy_teams := 20;
        NEW.max_drafts := 100;
      WHEN 'paid' THEN
        NEW.max_teams := 3;
        NEW.max_enemy_teams := 30;
        NEW.max_drafts := 1000;
      WHEN 'supporter' THEN
        NEW.max_teams := 3;
        NEW.max_enemy_teams := 30;
        NEW.max_drafts := 1000;
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

DROP TRIGGER IF EXISTS trigger_apply_tier_limits ON public.profiles;
CREATE TRIGGER trigger_apply_tier_limits
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.apply_tier_limits();

-- 5. Fix check_team_name_available: accept text instead of uuid
DROP FUNCTION IF EXISTS check_team_name_available(text, uuid);

CREATE OR REPLACE FUNCTION check_team_name_available(team_name text, exclude_team_id text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    name_exists boolean;
    _exclude_id uuid;
BEGIN
    IF exclude_team_id IS NOT NULL AND exclude_team_id <> '' THEN
        _exclude_id := exclude_team_id::uuid;
    END IF;

    IF _exclude_id IS NULL THEN
        SELECT EXISTS (
            SELECT 1 FROM my_teams
            WHERE LOWER(name) = LOWER(team_name)
        ) INTO name_exists;
    ELSE
        SELECT EXISTS (
            SELECT 1 FROM my_teams
            WHERE LOWER(name) = LOWER(team_name)
            AND id <> _exclude_id
        ) INTO name_exists;
    END IF;

    RETURN NOT name_exists;
END;
$$;

GRANT EXECUTE ON FUNCTION check_team_name_available(text, text) TO authenticated;
