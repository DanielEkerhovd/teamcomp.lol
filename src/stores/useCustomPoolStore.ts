import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CustomPool, ChampionGroup, generateId } from '../types';
import { cloudSync } from './middleware/cloudSync';

interface CustomPoolState {
  pools: CustomPool[];
  selectedPoolId: string | null;
  // Pool CRUD
  createPool: (name: string) => CustomPool;
  deletePool: (poolId: string) => void;
  renamePool: (poolId: string, newName: string) => void;
  selectPool: (poolId: string | null) => void;
  setAllowDuplicateChampions: (poolId: string, allowDuplicates: boolean) => void;
  // Champion group operations
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
  pools: CustomPool[],
  poolId: string,
  updater: (pool: CustomPool) => CustomPool
): CustomPool[] => pools.map((p) => (p.id === poolId ? updater(p) : p));

export const useCustomPoolStore = create<CustomPoolState>()(
  persist(
    cloudSync(
      (set, get) => ({
        pools: [],
        selectedPoolId: null,

        createPool: (name) => {
        const newPool: CustomPool = {
          id: generateId(),
          name,
          championGroups: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set((state) => ({ pools: [...state.pools, newPool], selectedPoolId: newPool.id }));
        return newPool;
      },

      deletePool: (poolId) => {
        set((state) => ({
          pools: state.pools.filter((p) => p.id !== poolId),
          selectedPoolId: state.selectedPoolId === poolId ? null : state.selectedPoolId,
        }));
      },

      renamePool: (poolId, newName) => {
        set((state) => ({
          pools: updatePool(state.pools, poolId, (pool) => ({
            ...pool,
            name: newName,
            updatedAt: Date.now(),
          })),
        }));
      },

      selectPool: (poolId) => {
        set({ selectedPoolId: poolId });
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
        storeKey: 'custom-pools',
        tableName: 'custom_pools',
        isArraySync: true,
        selectSyncData: (state) => state.pools,
        transformItem: (pool: CustomPool, userId: string, index: number) => ({
          id: pool.id,
          user_id: userId,
          name: pool.name,
          champion_groups: pool.championGroups,
          allow_duplicate_champions: pool.allowDuplicateChampions ?? false,
          sort_order: index,
        }),
      }
    ),
    {
      name: 'teamcomp-lol-custom-pools',
      version: 1,
    }
  )
);
