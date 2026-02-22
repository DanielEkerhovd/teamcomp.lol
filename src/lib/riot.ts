import { Region } from '../types';
import { isSupabaseConfigured } from './supabase';

// Cache duration: 24 hours minimum before refresh allowed
const REFRESH_COOLDOWN_MS = 24 * 60 * 60 * 1000;
// Display cache for 7 days
const CACHE_DISPLAY_MS = 7 * 24 * 60 * 60 * 1000;

// Types for Riot API responses
export interface RiotAccount {
  puuid: string;
  gameName: string;
  tagLine: string;
}

export interface Summoner {
  id: string;
  accountId: string;
  puuid: string;
  profileIconId: number;
  revisionDate: number;
  summonerLevel: number;
}

export type RankedTier =
  | 'IRON'
  | 'BRONZE'
  | 'SILVER'
  | 'GOLD'
  | 'PLATINUM'
  | 'EMERALD'
  | 'DIAMOND'
  | 'MASTER'
  | 'GRANDMASTER'
  | 'CHALLENGER';

export type RankedDivision = 'I' | 'II' | 'III' | 'IV';

export interface LeagueEntry {
  leagueId: string;
  summonerId: string;
  queueType: string;
  tier: RankedTier;
  rank: RankedDivision;
  leaguePoints: number;
  wins: number;
  losses: number;
  hotStreak: boolean;
  veteran: boolean;
  freshBlood: boolean;
  inactive: boolean;
}

export interface PlayerRank {
  tier: RankedTier;
  division: RankedDivision;
  lp: number;
  wins: number;
  losses: number;
  winRate: number;
}

export interface CachedRank {
  rank: PlayerRank | null;
  fetchedAt: number;
  error?: string;
  fromCache?: boolean;
  summonerLevel?: number;
}

// In-memory cache for rank data
const rankCache = new Map<string, CachedRank>();

// Generate cache key for a player
function getCacheKey(summonerName: string, tagLine: string, region: Region): string {
  return `${summonerName.toLowerCase()}#${tagLine.toLowerCase()}@${region}`;
}

// Check if cache entry is still valid for display (7 days)
function isCacheValidForDisplay(cached: CachedRank): boolean {
  return Date.now() - cached.fetchedAt < CACHE_DISPLAY_MS;
}

// Check if cache entry needs refresh (24 hours)
function isCacheStale(cached: CachedRank): boolean {
  return Date.now() - cached.fetchedAt >= REFRESH_COOLDOWN_MS;
}

// Check if Riot API is configured (requires Supabase with riot-proxy function)
export function isRiotApiConfigured(): boolean {
  return isSupabaseConfigured();
}

interface ProxyResponse {
  rank: PlayerRank | null;
  puuid?: string;
  summonerLevel?: number;
  fromCache?: boolean;
  cachedAt?: string;
  notCached?: boolean;
}

// Fetch rank via Supabase Edge Function (handles CORS and API key securely)
async function fetchRankFromProxy(
  gameName: string,
  tagLine: string,
  region: Region,
  cacheOnly = false
): Promise<ProxyResponse> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase not configured');
  }

  const params = new URLSearchParams({
    gameName,
    tagLine,
    region,
  });
  if (cacheOnly) {
    params.set('cacheOnly', 'true');
  }

  const url = `${supabaseUrl}/functions/v1/riot-proxy?${params}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMsg = errorData.error || `API error: ${response.status}`;
    console.error('[Riot API] Error:', errorMsg, errorData);
    throw new Error(errorMsg);
  }

  return await response.json();
}

// Check if a player's cache can be refreshed (24-hour cooldown)
export function canRefreshPlayer(summonerName: string, tagLine: string, region: Region): boolean {
  const cacheKey = getCacheKey(summonerName, tagLine, region);
  const cached = rankCache.get(cacheKey);
  if (!cached) return true;
  return Date.now() - cached.fetchedAt >= REFRESH_COOLDOWN_MS;
}

// Fetch from cache only (for page load auto-fetch)
export async function fetchPlayerRankFromCache(
  summonerName: string,
  tagLine: string,
  region: Region
): Promise<CachedRank | null> {
  if (!summonerName || !tagLine) {
    return null;
  }

  const cacheKey = getCacheKey(summonerName, tagLine, region);

  // Check local memory cache first
  const memCached = rankCache.get(cacheKey);
  if (memCached && Date.now() - memCached.fetchedAt < CACHE_DISPLAY_MS) {
    return memCached;
  }

  try {
    // Fetch from database cache only
    const response = await fetchRankFromProxy(summonerName, tagLine, region, true);

    if (response.notCached) {
      return null;
    }

    const fetchedAt = response.cachedAt ? new Date(response.cachedAt).getTime() : Date.now();
    const result: CachedRank = {
      rank: response.rank,
      fetchedAt,
      fromCache: true,
      summonerLevel: response.summonerLevel,
    };

    rankCache.set(cacheKey, result);
    return result;
  } catch {
    return null;
  }
}

// Main function: Fetch player rank (calls Riot API if cache is stale)
export async function fetchPlayerRank(
  summonerName: string,
  tagLine: string,
  region: Region,
  forceRefresh = false
): Promise<CachedRank> {
  if (!summonerName || !tagLine) {
    return { rank: null, fetchedAt: Date.now(), error: 'Missing summoner name or tag' };
  }

  const cacheKey = getCacheKey(summonerName, tagLine, region);

  try {
    // Fetch rank via Supabase Edge Function (it handles cache checking)
    const response = await fetchRankFromProxy(summonerName, tagLine, region, forceRefresh);

    const fetchedAt = response.cachedAt ? new Date(response.cachedAt).getTime() : Date.now();
    const result: CachedRank = {
      rank: response.rank,
      fetchedAt,
      fromCache: response.fromCache,
      summonerLevel: response.summonerLevel,
    };

    rankCache.set(cacheKey, result);
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const result: CachedRank = { rank: null, fetchedAt: Date.now(), error: errorMessage };

    // Cache errors briefly (5 minutes) to avoid hammering API on failures
    rankCache.set(cacheKey, { ...result, fetchedAt: Date.now() - REFRESH_COOLDOWN_MS + 5 * 60 * 1000 });

    return result;
  }
}

// Batch fetch ranks for multiple players
export async function fetchTeamRanks(
  players: Array<{ summonerName: string; tagLine: string; region: Region }>,
  forceRefresh = false
): Promise<Map<string, CachedRank>> {
  const results = new Map<string, CachedRank>();

  // Fetch in parallel with a small delay between requests to avoid rate limiting
  const promises = players.map(async (player, index) => {
    // Stagger requests by 100ms each to be nice to rate limits
    await new Promise((resolve) => setTimeout(resolve, index * 100));

    const result = await fetchPlayerRank(
      player.summonerName,
      player.tagLine,
      player.region,
      forceRefresh
    );

    const key = getCacheKey(player.summonerName, player.tagLine, player.region);
    results.set(key, result);
  });

  await Promise.all(promises);
  return results;
}

// Get cached rank (no fetch) - valid for display up to 7 days
export function getCachedRank(
  summonerName: string,
  tagLine: string,
  region: Region
): CachedRank | null {
  const cacheKey = getCacheKey(summonerName, tagLine, region);
  const cached = rankCache.get(cacheKey);

  if (cached && isCacheValidForDisplay(cached)) {
    return cached;
  }

  return null;
}

// Clear cache for a specific player
export function clearPlayerCache(summonerName: string, tagLine: string, region: Region): void {
  const cacheKey = getCacheKey(summonerName, tagLine, region);
  rankCache.delete(cacheKey);
}

// Clear entire cache
export function clearAllCache(): void {
  rankCache.clear();
}

// Format rank for display
export function formatRank(rank: PlayerRank | null): string {
  if (!rank) return 'Unranked';

  // Master+ don't have divisions
  if (['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(rank.tier)) {
    return `${formatTier(rank.tier)} ${rank.lp} LP`;
  }

  return `${formatTier(rank.tier)} ${rank.division}`;
}

// Format tier name (capitalize properly)
export function formatTier(tier: RankedTier): string {
  return tier.charAt(0) + tier.slice(1).toLowerCase();
}

// Get rank color for UI
export function getRankColor(tier: RankedTier | null): string {
  if (!tier) return 'text-gray-500';

  const colors: Record<RankedTier, string> = {
    IRON: 'text-gray-400',
    BRONZE: 'text-amber-700',
    SILVER: 'text-gray-300',
    GOLD: 'text-yellow-500',
    PLATINUM: 'text-cyan-400',
    EMERALD: 'text-emerald-400',
    DIAMOND: 'text-blue-400',
    MASTER: 'text-purple-400',
    GRANDMASTER: 'text-red-500',
    CHALLENGER: 'text-yellow-300',
  };

  return colors[tier];
}

// Get rank background color for badges
export function getRankBgColor(tier: RankedTier | null): string {
  if (!tier) return 'bg-gray-500/20';

  const colors: Record<RankedTier, string> = {
    IRON: 'bg-gray-400/20',
    BRONZE: 'bg-amber-700/20',
    SILVER: 'bg-gray-300/20',
    GOLD: 'bg-yellow-500/20',
    PLATINUM: 'bg-cyan-400/20',
    EMERALD: 'bg-emerald-400/20',
    DIAMOND: 'bg-blue-400/20',
    MASTER: 'bg-purple-400/20',
    GRANDMASTER: 'bg-red-500/20',
    CHALLENGER: 'bg-yellow-300/20',
  };

  return colors[tier];
}
