-- Stripe integration: subscriptions, donations, and tier automation

-- 1. Add stripe_customer_id to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT DEFAULT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id
  ON public.profiles(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

-- 2. Subscriptions table
CREATE TABLE public.subscriptions (
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

CREATE INDEX idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_sub_id ON public.subscriptions(stripe_subscription_id);

-- 3. Donations table
CREATE TABLE public.donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  stripe_payment_intent_id TEXT UNIQUE,
  stripe_checkout_session_id TEXT,
  amount INTEGER NOT NULL,  -- in cents
  currency TEXT NOT NULL DEFAULT 'eur',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'succeeded', 'failed')),
  donor_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_donations_user_id ON public.donations(user_id);

-- 4. RLS policies
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;

-- Users can read their own subscriptions
CREATE POLICY "Users can view own subscriptions"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Users can read their own donations
CREATE POLICY "Users can view own donations"
  ON public.donations FOR SELECT
  USING (auth.uid() = user_id);

-- 5. Trigger: auto-set tier limits when tier changes
-- This ensures max_teams/max_enemy_teams/max_drafts stay in sync with the tier,
-- whether changed by webhook, admin, or the revert_expired_tiers cron.
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

CREATE TRIGGER trigger_apply_tier_limits
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.apply_tier_limits();
