import { Region } from '../types';
import { isSupabaseConfigured } from './supabase';

// Cache duration: 1 week before refresh allowed
const REFRESH_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
// Display cache for 1 week
const CACHE_DISPLAY_MS = 7 * 24 * 60 * 60 * 1000;

export interface MasteryEntry {
  championId: number;
  championLevel: number;
  championPoints: number;
  lastPlayTime: number;
}

export interface CachedMastery {
  masteries: MasteryEntry[];
  fetchedAt: number;
  error?: string;
  fromCache?: boolean;
}

// In-memory cache for mastery data
const masteryCache = new Map<string, CachedMastery>();

function getCacheKey(summonerName: string, tagLine: string, region: Region): string {
  return `${summonerName.toLowerCase()}#${tagLine.toLowerCase()}@${region}`;
}

export function isMasteryApiConfigured(): boolean {
  return isSupabaseConfigured();
}

interface ProxyResponse {
  masteries: MasteryEntry[];
  puuid?: string;
  fromCache?: boolean;
  cachedAt?: string;
  notCached?: boolean;
}

async function fetchMasteryFromProxy(
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

  const url = `${supabaseUrl}/functions/v1/mastery-proxy?${params}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `API error: ${response.status}`);
  }

  return await response.json();
}

// Check if a player's mastery cache can be refreshed
export function canRefreshMastery(summonerName: string, tagLine: string, region: Region): boolean {
  const cacheKey = getCacheKey(summonerName, tagLine, region);
  const cached = masteryCache.get(cacheKey);
  if (!cached) return true;
  return Date.now() - cached.fetchedAt >= REFRESH_COOLDOWN_MS;
}

// Fetch from cache only (for page load)
export async function fetchMasteryFromCache(
  summonerName: string,
  tagLine: string,
  region: Region
): Promise<CachedMastery | null> {
  if (!summonerName || !tagLine) return null;

  const cacheKey = getCacheKey(summonerName, tagLine, region);

  // Check local memory cache first
  const memCached = masteryCache.get(cacheKey);
  if (memCached && Date.now() - memCached.fetchedAt < CACHE_DISPLAY_MS) {
    return memCached;
  }

  try {
    const response = await fetchMasteryFromProxy(summonerName, tagLine, region, true);

    if (response.notCached) {
      return null;
    }

    const fetchedAt = response.cachedAt ? new Date(response.cachedAt).getTime() : Date.now();
    const result: CachedMastery = {
      masteries: response.masteries,
      fetchedAt,
      fromCache: true,
    };

    masteryCache.set(cacheKey, result);
    return result;
  } catch {
    return null;
  }
}

// Fetch mastery (calls API if cache is stale)
export async function fetchMastery(
  summonerName: string,
  tagLine: string,
  region: Region
): Promise<CachedMastery> {
  if (!summonerName || !tagLine) {
    return { masteries: [], fetchedAt: Date.now(), error: 'Missing summoner name or tag' };
  }

  const cacheKey = getCacheKey(summonerName, tagLine, region);

  try {
    const response = await fetchMasteryFromProxy(summonerName, tagLine, region, false);

    const fetchedAt = response.cachedAt ? new Date(response.cachedAt).getTime() : Date.now();
    const result: CachedMastery = {
      masteries: response.masteries,
      fetchedAt,
      fromCache: response.fromCache,
    };

    masteryCache.set(cacheKey, result);
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const result: CachedMastery = { masteries: [], fetchedAt: Date.now(), error: errorMessage };
    masteryCache.set(cacheKey, { ...result, fetchedAt: Date.now() - REFRESH_COOLDOWN_MS + 5 * 60 * 1000 });
    return result;
  }
}

// Get cached mastery (no fetch)
export function getCachedMastery(
  summonerName: string,
  tagLine: string,
  region: Region
): CachedMastery | null {
  const cacheKey = getCacheKey(summonerName, tagLine, region);
  const cached = masteryCache.get(cacheKey);

  if (cached && Date.now() - cached.fetchedAt < CACHE_DISPLAY_MS) {
    return cached;
  }

  return null;
}

// Format mastery points (e.g., 1234567 -> "1.2M")
export function formatMasteryPoints(points: number): string {
  if (points >= 1000000) {
    return `${(points / 1000000).toFixed(1)}M`;
  }
  if (points >= 1000) {
    return `${(points / 1000).toFixed(0)}K`;
  }
  return points.toString();
}

// Get mastery level color
export function getMasteryLevelColor(level: number): string {
  if (level >= 7) return 'text-purple-400';
  if (level >= 6) return 'text-pink-400';
  if (level >= 5) return 'text-red-400';
  if (level >= 4) return 'text-yellow-400';
  return 'text-gray-400';
}

// Get mastery level badge color
export function getMasteryBadgeColor(level: number): string {
  if (level >= 7) return 'bg-purple-500/20 border-purple-500/50';
  if (level >= 6) return 'bg-pink-500/20 border-pink-500/50';
  if (level >= 5) return 'bg-red-500/20 border-red-500/50';
  if (level >= 4) return 'bg-yellow-500/20 border-yellow-500/50';
  return 'bg-gray-500/20 border-gray-500/50';
}
