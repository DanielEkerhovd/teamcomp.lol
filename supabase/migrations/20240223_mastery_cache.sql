-- Table to cache player champion mastery data
-- Stores top masteries for each player to avoid repeated API calls

CREATE TABLE IF NOT EXISTS mastery_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  -- Player identification (stored lowercase for case-insensitive matching)
  game_name TEXT NOT NULL,
  tag_line TEXT NOT NULL,
  region TEXT NOT NULL,
  puuid TEXT,
  -- Top masteries stored as JSONB array
  -- Each entry: { championId, championLevel, championPoints, lastPlayTime }
  top_masteries JSONB NOT NULL DEFAULT '[]',
  -- Timestamps
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Unique constraint for player lookup
  UNIQUE (game_name, tag_line, region)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_mastery_cache_lookup
ON mastery_cache (game_name, tag_line, region);

-- Index for cache expiry queries
CREATE INDEX IF NOT EXISTS idx_mastery_cache_fetched_at
ON mastery_cache (fetched_at);

-- Enable Row Level Security
ALTER TABLE mastery_cache ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read the cache (public data)
CREATE POLICY "Allow public read mastery" ON mastery_cache
  FOR SELECT USING (true);

-- Allow Edge Functions to insert/update (using service role)
CREATE POLICY "Allow service insert mastery" ON mastery_cache
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow service update mastery" ON mastery_cache
  FOR UPDATE USING (true);

CREATE POLICY "Allow service delete mastery" ON mastery_cache
  FOR DELETE USING (true);
