import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { PlayerPool, Role, ChampionGroup, generateId } from '../types';
import { cloudSync } from './middleware/cloudSync';

// Normalize name for consistent lookups (case-insensitive, trimmed)
const normalizeName = (name: string) => name.toLowerCase().trim();

interface PlayerPoolState {
  pools: PlayerPool[];
  // Find pool for a player+role (returns null if not found)
  findPool: (summonerName: string, role: Role) => PlayerPool | null;
  // Get existing pool or create a new one (called when a player has a name)
  getOrCreatePool: (summonerName: string, tagLine: string, role: Role) => PlayerPool;
  // Settings
  setAllowDuplicateChampions: (poolId: string, allowDuplicates: boolean) => void;
  // Champion group operations (all keyed by pool id)
  addChampionToGroup: (poolId: string, groupId: string, championId: string) => void;
  removeChampionFromGroup: (poolId: string, groupId: string, championId: string) => void;
  moveChampion: (poolId: string, fromGroupId: string, toGroupId: string, championId: string, newIndex: number) => void;
  reorderChampionInGroup: (poolId: string, groupId: string, championId: string, newIndex: number) => void;
  addGroup: (poolId: string, groupName: string) => void;
  removeGroup: (poolId: string, groupId: string) => void;
  renameGroup: (poolId: string, groupId: string, newName: string) => void;
  reorderGroups: (poolId: string, groupIds: string[]) => void;
}

const updatePool = (
  pools: PlayerPool[],
  poolId: string,
  updater: (pool: PlayerPool) => PlayerPool
): PlayerPool[] => pools.map((p) => (p.id === poolId ? updater(p) : p));

export const usePlayerPoolStore = create<PlayerPoolState>()(
  persist(
    cloudSync(
      (set, get) => ({
        pools: [],

        findPool: (summonerName, role) => {
        const normalized = normalizeName(summonerName);
        return (
          get().pools.find(
            (p) => normalizeName(p.summonerName) === normalized && p.role === role
          ) ?? null
        );
      },

      getOrCreatePool: (summonerName, tagLine, role) => {
        const existing = get().findPool(summonerName, role);
        if (existing) return existing;

        const newPool: PlayerPool = {
          id: generateId(),
          summonerName,
          tagLine,
          role,
          championGroups: [],
          updatedAt: Date.now(),
        };
        set((state) => ({ pools: [...state.pools, newPool] }));
        return newPool;
      },

      setAllowDuplicateChampions: (poolId, allowDuplicates) => {
        set((state) => ({
          pools: updatePool(state.pools, poolId, (pool) => ({
            ...pool,
            allowDuplicateChampions: allowDuplicates,
            updatedAt: Date.now(),
          })),
        }));
      },

      addChampionToGroup: (poolId, groupId, championId) => {
        set((state) => ({
          pools: updatePool(state.pools, poolId, (pool) => ({
            ...pool,
            championGroups: pool.championGroups.map((g) =>
              g.id === groupId && !g.championIds.includes(championId)
                ? { ...g, championIds: [...g.championIds, championId] }
                : g
            ),
            updatedAt: Date.now(),
          })),
        }));
      },

      removeChampionFromGroup: (poolId, groupId, championId) => {
        set((state) => ({
          pools: updatePool(state.pools, poolId, (pool) => ({
            ...pool,
            championGroups: pool.championGroups.map((g) =>
              g.id === groupId
                ? { ...g, championIds: g.championIds.filter((id) => id !== championId) }
                : g
            ),
            updatedAt: Date.now(),
          })),
        }));
      },

      moveChampion: (poolId, fromGroupId, toGroupId, championId, newIndex) => {
        set((state) => ({
          pools: updatePool(state.pools, poolId, (pool) => ({
            ...pool,
            championGroups: pool.championGroups.map((g) => {
              if (g.id === fromGroupId) {
                return { ...g, championIds: g.championIds.filter((id) => id !== championId) };
              }
              if (g.id === toGroupId) {
                const newIds = g.championIds.filter((id) => id !== championId);
                newIds.splice(newIndex, 0, championId);
                return { ...g, championIds: newIds };
              }
              return g;
            }),
            updatedAt: Date.now(),
          })),
        }));
      },

      reorderChampionInGroup: (poolId, groupId, championId, newIndex) => {
        set((state) => ({
          pools: updatePool(state.pools, poolId, (pool) => ({
            ...pool,
            championGroups: pool.championGroups.map((g) => {
              if (g.id !== groupId) return g;
              const newIds = g.championIds.filter((id) => id !== championId);
              newIds.splice(newIndex, 0, championId);
              return { ...g, championIds: newIds };
            }),
            updatedAt: Date.now(),
          })),
        }));
      },

      addGroup: (poolId, groupName) => {
        set((state) => ({
          pools: updatePool(state.pools, poolId, (pool) => ({
            ...pool,
            championGroups: [
              ...pool.championGroups,
              { id: generateId(), name: groupName, championIds: [] } as ChampionGroup,
            ],
            updatedAt: Date.now(),
          })),
        }));
      },

      removeGroup: (poolId, groupId) => {
        set((state) => ({
          pools: updatePool(state.pools, poolId, (pool) => ({
            ...pool,
            championGroups: pool.championGroups.filter((g) => g.id !== groupId),
            updatedAt: Date.now(),
          })),
        }));
      },

      renameGroup: (poolId, groupId, newName) => {
        set((state) => ({
          pools: updatePool(state.pools, poolId, (pool) => ({
            ...pool,
            championGroups: pool.championGroups.map((g) =>
              g.id === groupId ? { ...g, name: newName } : g
            ),
            updatedAt: Date.now(),
          })),
        }));
      },

      reorderGroups: (poolId, groupIds) => {
        set((state) => ({
          pools: updatePool(state.pools, poolId, (pool) => {
            const reordered = groupIds
              .map((id) => pool.championGroups.find((g) => g.id === id))
              .filter((g): g is ChampionGroup => g !== undefined);
            return { ...pool, championGroups: reordered, updatedAt: Date.now() };
          }),
        }));
      },
    }),
      {
        storeKey: 'player-pools',
        tableName: 'player_pools',
        isArraySync: true,
        selectSyncData: (state) => state.pools,
        transformItem: (pool: PlayerPool, userId: string) => ({
          id: pool.id,
          user_id: userId,
          summoner_name: pool.summonerName,
          tag_line: pool.tagLine || '',
          role: pool.role,
          champion_groups: pool.championGroups,
          allow_duplicate_champions: pool.allowDuplicateChampions ?? false,
        }),
      }
    ),
    {
      name: 'teamcomp-lol-player-pools',
      version: 2,
    }
  )
);
