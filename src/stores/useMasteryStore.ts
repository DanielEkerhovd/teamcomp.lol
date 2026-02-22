import { create } from 'zustand';
import { Region } from '../types';
import {
  fetchMastery,
  fetchMasteryFromCache,
  CachedMastery,
  isMasteryApiConfigured,
  canRefreshMastery,
} from '../lib/mastery';

interface PlayerKey {
  summonerName: string;
  tagLine: string;
  region: Region;
}

function getKey(player: PlayerKey): string {
  return `${player.summonerName.toLowerCase()}#${player.tagLine.toLowerCase()}@${player.region}`;
}

interface MasteryState {
  // Map of player key -> mastery data
  masteries: Map<string, CachedMastery>;
  // Set of player keys currently being fetched
  fetching: Set<string>;
  // Last error message
  lastError: string | null;

  // Actions
  fetchMasteryForPlayer: (player: PlayerKey) => Promise<CachedMastery | null>;
  fetchMasteriesForPlayers: (players: PlayerKey[]) => Promise<void>;
  fetchMasteriesFromCache: (players: PlayerKey[]) => Promise<void>;
  getMastery: (player: PlayerKey) => CachedMastery | null;
  isFetching: (player: PlayerKey) => boolean;
  isConfigured: () => boolean;
  canRefresh: (player: PlayerKey) => boolean;
}

export const useMasteryStore = create<MasteryState>((set, get) => ({
  masteries: new Map(),
  fetching: new Set(),
  lastError: null,

  fetchMasteryForPlayer: async (player) => {
    if (!player.summonerName || !player.tagLine) return null;
    if (!isMasteryApiConfigured()) {
      set({ lastError: 'Mastery API not configured' });
      return null;
    }

    const key = getKey(player);

    // Check if already fetching
    if (get().fetching.has(key)) return null;

    // Mark as fetching
    set((state) => {
      const newFetching = new Set(state.fetching);
      newFetching.add(key);
      return { fetching: newFetching, lastError: null };
    });

    try {
      const result = await fetchMastery(
        player.summonerName,
        player.tagLine,
        player.region
      );

      set((state) => {
        const newMasteries = new Map(state.masteries);
        const newFetching = new Set(state.fetching);
        newMasteries.set(key, result);
        newFetching.delete(key);
        return {
          masteries: newMasteries,
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

  fetchMasteriesForPlayers: async (players) => {
    if (!isMasteryApiConfigured()) return;

    const validPlayers = players.filter(
      (p) => p.summonerName && p.tagLine && get().canRefresh(p)
    );

    if (validPlayers.length === 0) return;

    // Fetch in parallel with staggered timing
    await Promise.all(
      validPlayers.map((player, index) =>
        new Promise<void>((resolve) => {
          setTimeout(async () => {
            await get().fetchMasteryForPlayer(player);
            resolve();
          }, index * 100);
        })
      )
    );
  },

  fetchMasteriesFromCache: async (players) => {
    if (!isMasteryApiConfigured()) return;

    const validPlayers = players.filter((p) => p.summonerName && p.tagLine);
    if (validPlayers.length === 0) return;

    const results = await Promise.all(
      validPlayers.map(async (player) => {
        const key = getKey(player);
        const existing = get().masteries.get(key);
        if (existing) return { key, result: existing };

        const result = await fetchMasteryFromCache(
          player.summonerName,
          player.tagLine,
          player.region
        );
        return { key, result };
      })
    );

    set((state) => {
      const newMasteries = new Map(state.masteries);
      for (const { key, result } of results) {
        if (result) {
          newMasteries.set(key, result);
        }
      }
      return { masteries: newMasteries };
    });
  },

  getMastery: (player) => {
    const key = getKey(player);
    return get().masteries.get(key) || null;
  },

  isFetching: (player) => {
    const key = getKey(player);
    return get().fetching.has(key);
  },

  isConfigured: () => isMasteryApiConfigured(),

  canRefresh: (player) => {
    if (!player.summonerName || !player.tagLine) return false;
    return canRefreshMastery(player.summonerName, player.tagLine, player.region);
  },
}));
