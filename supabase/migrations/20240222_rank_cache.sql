-- Table to cache player rank data
-- This allows sharing rank data across users and reduces API calls

CREATE TABLE IF NOT EXISTS rank_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  -- Player identification (stored lowercase for case-insensitive matching)
  game_name TEXT NOT NULL,
  tag_line TEXT NOT NULL,
  region TEXT NOT NULL,
  -- Riot identifiers
  puuid TEXT,
  -- Rank data (null means unranked)
  tier TEXT,
  division TEXT,
  lp INTEGER,
  wins INTEGER,
  losses INTEGER,
  win_rate INTEGER,
  summoner_level INTEGER,
  -- Timestamps
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Unique constraint for player lookup (values stored lowercase)
  UNIQUE (game_name, tag_line, region)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_rank_cache_lookup
ON rank_cache (game_name, tag_line, region);

-- Index for cache expiry queries
CREATE INDEX IF NOT EXISTS idx_rank_cache_fetched_at
ON rank_cache (fetched_at);

-- Enable Row Level Security
ALTER TABLE rank_cache ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read the cache (public data)
CREATE POLICY "Allow public read" ON rank_cache
  FOR SELECT USING (true);

-- Allow Edge Functions to insert/update (using service role)
CREATE POLICY "Allow service insert" ON rank_cache
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow service update" ON rank_cache
  FOR UPDATE USING (true);
