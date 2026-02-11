import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ChampionPriority, Role, Priority, generateId } from '../types';

interface ChampionPoolState {
  contestedPicks: string[];
  potentialBans: string[];
  priorities: ChampionPriority[];

  // Contested picks
  addContestedPick: (championId: string) => void;
  removeContestedPick: (championId: string) => void;
  clearContestedPicks: () => void;

  // Potential bans
  addPotentialBan: (championId: string) => void;
  removePotentialBan: (championId: string) => void;
  clearPotentialBans: () => void;

  // Priorities
  addPriority: (championId: string, role: Role, priority: Priority, notes?: string) => void;
  updatePriority: (championId: string, updates: Partial<Omit<ChampionPriority, 'championId'>>) => void;
  removePriority: (championId: string) => void;
  clearPriorities: () => void;
}

export const useChampionPoolStore = create<ChampionPoolState>()(
  persist(
    (set) => ({
      contestedPicks: [],
      potentialBans: [],
      priorities: [],

      // Contested picks
      addContestedPick: (championId: string) => {
        set((state) => ({
          contestedPicks: state.contestedPicks.includes(championId)
            ? state.contestedPicks
            : [...state.contestedPicks, championId],
        }));
      },

      removeContestedPick: (championId: string) => {
        set((state) => ({
          contestedPicks: state.contestedPicks.filter((id) => id !== championId),
        }));
      },

      clearContestedPicks: () => {
        set({ contestedPicks: [] });
      },

      // Potential bans
      addPotentialBan: (championId: string) => {
        set((state) => ({
          potentialBans: state.potentialBans.includes(championId)
            ? state.potentialBans
            : [...state.potentialBans, championId],
        }));
      },

      removePotentialBan: (championId: string) => {
        set((state) => ({
          potentialBans: state.potentialBans.filter((id) => id !== championId),
        }));
      },

      clearPotentialBans: () => {
        set({ potentialBans: [] });
      },

      // Priorities
      addPriority: (championId: string, role: Role, priority: Priority, notes: string = '') => {
        set((state) => {
          const exists = state.priorities.find((p) => p.championId === championId);
          if (exists) {
            return {
              priorities: state.priorities.map((p) =>
                p.championId === championId ? { ...p, role, priority, notes } : p
              ),
            };
          }
          return {
            priorities: [...state.priorities, { championId, role, priority, notes }],
          };
        });
      },

      updatePriority: (championId: string, updates: Partial<Omit<ChampionPriority, 'championId'>>) => {
        set((state) => ({
          priorities: state.priorities.map((p) =>
            p.championId === championId ? { ...p, ...updates } : p
          ),
        }));
      },

      removePriority: (championId: string) => {
        set((state) => ({
          priorities: state.priorities.filter((p) => p.championId !== championId),
        }));
      },

      clearPriorities: () => {
        set({ priorities: [] });
      },
    }),
    {
      name: 'teamcomp-lol-champion-pool',
    }
  )
);
