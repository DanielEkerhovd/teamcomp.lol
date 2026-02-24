-- TeamComp.lol Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PROFILES TABLE (extends Supabase auth.users)
-- ============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  tier TEXT DEFAULT 'free' CHECK (tier IN ('free', 'paid', 'admin')),
  max_teams INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- USER SETTINGS
-- ============================================
CREATE TABLE public.user_settings (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  default_region TEXT DEFAULT 'euw',
  has_completed_onboarding BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- MY TEAMS (user's own teams)
-- ============================================
CREATE TABLE public.my_teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  notes TEXT DEFAULT '',
  champion_pool JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  sort_order INTEGER DEFAULT 0
);

CREATE INDEX idx_my_teams_user ON public.my_teams(user_id);

-- ============================================
-- PLAYERS (belong to my_teams)
-- ============================================
CREATE TABLE public.players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES public.my_teams(id) ON DELETE CASCADE,
  summoner_name TEXT NOT NULL,
  tag_line TEXT DEFAULT '',
  role TEXT NOT NULL CHECK (role IN ('top', 'jungle', 'mid', 'adc', 'support')),
  notes TEXT DEFAULT '',
  region TEXT DEFAULT 'euw',
  is_sub BOOLEAN DEFAULT FALSE,
  champion_pool JSONB DEFAULT '[]',
  champion_groups JSONB DEFAULT '[]',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_players_team ON public.players(team_id);

-- ============================================
-- ENEMY TEAMS
-- ============================================
CREATE TABLE public.enemy_teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  notes TEXT DEFAULT '',
  is_favorite BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_enemy_teams_user ON public.enemy_teams(user_id);

-- ============================================
-- ENEMY PLAYERS
-- ============================================
CREATE TABLE public.enemy_players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES public.enemy_teams(id) ON DELETE CASCADE,
  summoner_name TEXT NOT NULL,
  tag_line TEXT DEFAULT '',
  role TEXT NOT NULL,
  notes TEXT DEFAULT '',
  region TEXT DEFAULT 'euw',
  is_sub BOOLEAN DEFAULT FALSE,
  champion_pool JSONB DEFAULT '[]',
  champion_groups JSONB DEFAULT '[]',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_enemy_players_team ON public.enemy_players(team_id);

-- ============================================
-- DRAFT SESSIONS
-- ============================================
CREATE TABLE public.draft_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  enemy_team_id UUID REFERENCES public.enemy_teams(id) ON DELETE SET NULL,
  contested_picks TEXT[] DEFAULT '{}',
  potential_bans TEXT[] DEFAULT '{}',
  our_priorities JSONB DEFAULT '[]',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_draft_sessions_user ON public.draft_sessions(user_id);

-- ============================================
-- PLAYER POOLS (persistent across teams)
-- ============================================
CREATE TABLE public.player_pools (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  summoner_name TEXT NOT NULL,
  tag_line TEXT DEFAULT '',
  role TEXT NOT NULL,
  champion_groups JSONB DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, summoner_name, role)
);

CREATE INDEX idx_player_pools_user ON public.player_pools(user_id);

-- ============================================
-- CUSTOM POOLS (tier lists, etc.)
-- ============================================
CREATE TABLE public.custom_pools (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  champion_groups JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_custom_pools_user ON public.custom_pools(user_id);

-- ============================================
-- CUSTOM TEMPLATES
-- ============================================
CREATE TABLE public.custom_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  groups TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_custom_templates_user ON public.custom_templates(user_id);

-- ============================================
-- DRAFT THEORY (tool state)
-- ============================================
CREATE TABLE public.draft_theory (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  blue_bans TEXT[] DEFAULT ARRAY[NULL,NULL,NULL,NULL,NULL]::TEXT[],
  blue_picks TEXT[] DEFAULT ARRAY[NULL,NULL,NULL,NULL,NULL]::TEXT[],
  red_bans TEXT[] DEFAULT ARRAY[NULL,NULL,NULL,NULL,NULL]::TEXT[],
  red_picks TEXT[] DEFAULT ARRAY[NULL,NULL,NULL,NULL,NULL]::TEXT[],
  blue_team_name TEXT DEFAULT 'Blue Side',
  red_team_name TEXT DEFAULT 'Red Side',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CHAMPION POOL STATE (global picks/bans)
-- ============================================
CREATE TABLE public.champion_pool_state (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  contested_picks TEXT[] DEFAULT '{}',
  potential_bans TEXT[] DEFAULT '{}',
  priorities JSONB DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.my_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enemy_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enemy_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draft_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draft_theory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.champion_pool_state ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Settings
CREATE POLICY "Users can manage own settings" ON public.user_settings
  FOR ALL USING (auth.uid() = user_id);

-- My Teams
CREATE POLICY "Users can manage own teams" ON public.my_teams
  FOR ALL USING (auth.uid() = user_id);

-- Players
CREATE POLICY "Users can manage players in own teams" ON public.players
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.my_teams
      WHERE my_teams.id = players.team_id
      AND my_teams.user_id = auth.uid()
    )
  );

-- Enemy Teams
CREATE POLICY "Users can manage own enemy teams" ON public.enemy_teams
  FOR ALL USING (auth.uid() = user_id);

-- Enemy Players
CREATE POLICY "Users can manage enemy players in own teams" ON public.enemy_players
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.enemy_teams
      WHERE enemy_teams.id = enemy_players.team_id
      AND enemy_teams.user_id = auth.uid()
    )
  );

-- Draft Sessions
CREATE POLICY "Users can manage own draft sessions" ON public.draft_sessions
  FOR ALL USING (auth.uid() = user_id);

-- Player Pools
CREATE POLICY "Users can manage own player pools" ON public.player_pools
  FOR ALL USING (auth.uid() = user_id);

-- Custom Pools
CREATE POLICY "Users can manage own custom pools" ON public.custom_pools
  FOR ALL USING (auth.uid() = user_id);

-- Custom Templates
CREATE POLICY "Users can manage own templates" ON public.custom_templates
  FOR ALL USING (auth.uid() = user_id);

-- Draft Theory
CREATE POLICY "Users can manage own draft theory" ON public.draft_theory
  FOR ALL USING (auth.uid() = user_id);

-- Champion Pool State
CREATE POLICY "Users can manage own champion pool state" ON public.champion_pool_state
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- FUNCTIONS AND TRIGGERS
-- ============================================

-- Auto-create profile and settings on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  );

  INSERT INTO public.user_settings (user_id)
  VALUES (NEW.id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_my_teams_updated_at BEFORE UPDATE ON public.my_teams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_players_updated_at BEFORE UPDATE ON public.players
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_enemy_teams_updated_at BEFORE UPDATE ON public.enemy_teams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_enemy_players_updated_at BEFORE UPDATE ON public.enemy_players
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_draft_sessions_updated_at BEFORE UPDATE ON public.draft_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_player_pools_updated_at BEFORE UPDATE ON public.player_pools
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_custom_pools_updated_at BEFORE UPDATE ON public.custom_pools
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_draft_theory_updated_at BEFORE UPDATE ON public.draft_theory
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_champion_pool_state_updated_at BEFORE UPDATE ON public.champion_pool_state
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Team limit enforcement
CREATE OR REPLACE FUNCTION public.check_team_limit()
RETURNS TRIGGER AS $$
DECLARE
  team_count INTEGER;
  max_allowed INTEGER;
BEGIN
  SELECT COUNT(*) INTO team_count
  FROM public.my_teams
  WHERE user_id = NEW.user_id;

  SELECT max_teams INTO max_allowed
  FROM public.profiles
  WHERE id = NEW.user_id;

  IF team_count >= COALESCE(max_allowed, 1) THEN
    RAISE EXCEPTION 'Team limit reached. Upgrade to create more teams.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_team_limit
  BEFORE INSERT ON public.my_teams
  FOR EACH ROW EXECUTE FUNCTION public.check_team_limit();
