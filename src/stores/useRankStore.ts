import { create } from 'zustand';
import { Region } from '../types';
import {
  fetchPlayerRank,
  fetchPlayerRankFromCache,
  CachedRank,
  isRiotApiConfigured,
  canRefreshPlayer,
  clearAllCache,
} from '../lib/riot';

interface PlayerKey {
  summonerName: string;
  tagLine: string;
  region: Region;
}

function getKey(player: PlayerKey): string {
  return `${player.summonerName.toLowerCase()}#${player.tagLine.toLowerCase()}@${player.region}`;
}

interface RankState {
  // Map of player key -> rank data (in-memory cache)
  ranks: Map<string, CachedRank>;
  // Set of player keys currently being fetched
  fetching: Set<string>;
  // Set of context IDs currently fetching
  fetchingContexts: Set<string>;
  // Last error message
  lastError: string | null;

  // Actions
  fetchRank: (player: PlayerKey) => Promise<CachedRank | null>;
  fetchRanksForContext: (contextId: string, players: PlayerKey[]) => Promise<boolean>;
  fetchRanksFromCache: (players: PlayerKey[]) => Promise<void>;
  getRank: (player: PlayerKey) => CachedRank | null;
  isFetching: (player: PlayerKey) => boolean;
  isFetchingContext: (contextId: string) => boolean;
  clearCache: () => void;
  isConfigured: () => boolean;
  // Per-player cooldown helpers
  canRefresh: (player: PlayerKey) => boolean;
  allPlayersUpdated: (players: PlayerKey[]) => boolean;
  somePlayersNeedUpdate: (players: PlayerKey[]) => boolean;
}

export const useRankStore = create<RankState>((set, get) => ({
  ranks: new Map(),
  fetching: new Set(),
  fetchingContexts: new Set(),
  lastError: null,

  fetchRank: async (player) => {
    if (!player.summonerName || !player.tagLine) {
      return null;
    }

    if (!isRiotApiConfigured()) {
      set({ lastError: 'Riot API key not configured' });
      return null;
    }

    const key = getKey(player);

    // Check if already fetching
    if (get().fetching.has(key)) {
      return null;
    }

    // Mark as fetching
    set((state) => {
      const newFetching = new Set(state.fetching);
      newFetching.add(key);
      return { fetching: newFetching, lastError: null };
    });

    try {
      const result = await fetchPlayerRank(
        player.summonerName,
        player.tagLine,
        player.region
      );

      // Update store
      set((state) => {
        const newRanks = new Map(state.ranks);
        const newFetching = new Set(state.fetching);
        newRanks.set(key, result);
        newFetching.delete(key);
        return {
          ranks: newRanks,
          fetching: newFetching,
          lastError: result.error || null,
        };
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      set((state) => {
        const newFetching = new Set(state.fetching);
        newFetching.delete(key);
        return {
          fetching: newFetching,
          lastError: errorMessage,
        };
      });

      return null;
    }
  },

  fetchRanksForContext: async (contextId, players) => {
    if (!isRiotApiConfigured()) {
      set({ lastError: 'Riot API key not configured' });
      return false;
    }

    // Filter to only players that need update (can be refreshed)
    const playersToUpdate = players.filter(
      (p) => p.summonerName && p.tagLine && get().canRefresh(p)
    );

    if (playersToUpdate.length === 0) {
      // All players are up to date
      return true;
    }

    // Mark context as fetching
    set((state) => {
      const newFetchingContexts = new Set(state.fetchingContexts);
      newFetchingContexts.add(contextId);
      return { fetchingContexts: newFetchingContexts, lastError: null };
    });

    // Fetch only stale players in parallel
    const results = await Promise.all(
      playersToUpdate.map((player) => get().fetchRank(player))
    );

    // Check if at least one fetch was successful
    const hasSuccessfulFetch = results.some((r) => r && !r.error);

    // Update context state
    set((state) => {
      const newFetchingContexts = new Set(state.fetchingContexts);
      newFetchingContexts.delete(contextId);
      return { fetchingContexts: newFetchingContexts };
    });

    return hasSuccessfulFetch;
  },

  fetchRanksFromCache: async (players) => {
    if (!isRiotApiConfigured()) {
      return;
    }

    const validPlayers = players.filter((p) => p.summonerName && p.tagLine);
    if (validPlayers.length === 0) return;

    // Fetch from cache in parallel (no rate limiting needed for cache)
    const results = await Promise.all(
      validPlayers.map(async (player) => {
        const key = getKey(player);
        // Check if we already have it in memory
        const existing = get().ranks.get(key);
        if (existing) return { key, result: existing };

        const result = await fetchPlayerRankFromCache(
          player.summonerName,
          player.tagLine,
          player.region
        );
        return { key, result };
      })
    );

    // Update store with all results
    set((state) => {
      const newRanks = new Map(state.ranks);
      for (const { key, result } of results) {
        if (result) {
          newRanks.set(key, result);
        }
      }
      return { ranks: newRanks };
    });
  },

  getRank: (player) => {
    const key = getKey(player);
    return get().ranks.get(key) || null;
  },

  isFetching: (player) => {
    const key = getKey(player);
    return get().fetching.has(key);
  },

  isFetchingContext: (contextId) => {
    return get().fetchingContexts.has(contextId);
  },

  clearCache: () => {
    clearAllCache();
    set({ ranks: new Map(), lastError: null });
  },

  isConfigured: () => isRiotApiConfigured(),

  canRefresh: (player) => {
    if (!player.summonerName || !player.tagLine) return false;
    return canRefreshPlayer(player.summonerName, player.tagLine, player.region);
  },

  allPlayersUpdated: (players) => {
    const validPlayers = players.filter((p) => p.summonerName && p.tagLine);
    if (validPlayers.length === 0) return false;

    // All players must have rank data and not be refreshable (< 24 hours old)
    return validPlayers.every((p) => {
      const rank = get().getRank(p);
      return rank && !get().canRefresh(p);
    });
  },

  somePlayersNeedUpdate: (players) => {
    const validPlayers = players.filter((p) => p.summonerName && p.tagLine);
    if (validPlayers.length === 0) return false;

    // At least one player can be refreshed (no data or > 24 hours old)
    return validPlayers.some((p) => get().canRefresh(p));
  },
}));
