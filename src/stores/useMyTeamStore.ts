import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Team, Player, createEmptyTeam, createSubPlayer, generateId, Region, Role, ROLES, ChampionTier, TieredChampion, Note } from '../types';
import { useSettingsStore } from './useSettingsStore';
import { useAuthStore } from './useAuthStore';
import { cloudSync } from './middleware/cloudSync';
import { syncManager } from '../lib/syncManager';
import { usePlayerPoolStore } from './usePlayerPoolStore';

// Guest mode limit (MAX_TEAMS exported for backward compatibility)
export const MAX_TEAMS_GUEST = 3;
export const MAX_TEAMS = MAX_TEAMS_GUEST;

// Get the maximum teams allowed based on auth state
export const getMaxTeams = (): number => {
  const { user, profile } = useAuthStore.getState();
  if (!user) return MAX_TEAMS_GUEST; // Guest mode
  return profile?.maxTeams ?? 1; // Authenticated: use tier limit
};

interface MyTeamState {
  teams: Team[];
  selectedTeamId: string;
  // Team management
  addTeam: (name: string) => Team | null;
  deleteTeam: (id: string) => void;
  selectTeam: (id: string) => void;
  // Existing actions (operate on selected team)
  updateTeam: (updates: Partial<Omit<Team, 'id' | 'createdAt'>>) => void;
  updatePlayer: (playerId: string, updates: Partial<Omit<Player, 'id'>>) => void;
  importFromOpgg: (region: Region, players: { summonerName: string; tagLine: string }[]) => void;
  addSub: () => void;
  removeSub: (playerId: string) => void;
  resetTeam: () => void;
  swapPlayerRoles: (playerId1: string, playerId2: string) => void;
  moveToRole: (playerId: string, role: Role) => void;
  moveToSubs: (playerId: string) => void;
  setChampionTier: (playerId: string, championId: string, tier: ChampionTier) => void;
  removeChampionFromPool: (playerId: string, championId: string) => void;
  // Group-based champion management
  addChampionToGroup: (playerId: string, groupId: string, championId: string) => void;
  removeChampionFromGroup: (playerId: string, groupId: string, championId: string) => void;
  moveChampion: (playerId: string, fromGroupId: string, toGroupId: string, championId: string, newIndex: number) => void;
  reorderChampionInGroup: (playerId: string, groupId: string, championId: string, newIndex: number) => void;
  addGroup: (playerId: string, groupName: string) => void;
  removeGroup: (playerId: string, groupId: string) => void;
  renameGroup: (playerId: string, groupId: string, newName: string) => void;
  reorderGroups: (playerId: string, groupIds: string[]) => void;
  // Notepad management
  addNote: () => void;
  updateNote: (noteId: string, content: string) => void;
  deleteNote: (noteId: string) => void;
}

// Helper to get selected team and update it
const updateSelectedTeam = (
  state: { teams: Team[]; selectedTeamId: string },
  updater: (team: Team) => Team
): { teams: Team[] } => ({
  teams: state.teams.map((t) =>
    t.id === state.selectedTeamId ? updater(t) : t
  ),
});

const initialTeam = createEmptyTeam('My Team');

export const useMyTeamStore = create<MyTeamState>()(
  persist(
    cloudSync(
      (set, get) => ({
        teams: [initialTeam],
        selectedTeamId: initialTeam.id,

      addTeam: (name: string) => {
        const state = get();
        const maxTeams = getMaxTeams();
        if (state.teams.length >= maxTeams) return null;
        const newTeam = createEmptyTeam(name);
        set({ teams: [...state.teams, newTeam], selectedTeamId: newTeam.id });
        return newTeam;
      },

      deleteTeam: (id: string) => {
        const state = get();
        if (state.teams.length <= 1) return; // Can't delete last team
        const newTeams = state.teams.filter((t) => t.id !== id);
        const newSelectedId =
          state.selectedTeamId === id ? newTeams[0].id : state.selectedTeamId;
        set({ teams: newTeams, selectedTeamId: newSelectedId });
      },

      selectTeam: (id: string) => {
        const state = get();
        if (state.teams.some((t) => t.id === id)) {
          set({ selectedTeamId: id });
        }
      },

      updateTeam: (updates: Partial<Omit<Team, 'id' | 'createdAt'>>) => {
        set((state) =>
          updateSelectedTeam(state, (team) => ({
            ...team,
            ...updates,
            updatedAt: Date.now(),
          }))
        );
      },

      updatePlayer: (playerId: string, updates: Partial<Omit<Player, 'id'>>) => {
        set((state) =>
          updateSelectedTeam(state, (team) => ({
            ...team,
            players: team.players.map((player) =>
              player.id === playerId ? { ...player, ...updates } : player
            ),
            updatedAt: Date.now(),
          }))
        );
      },

      importFromOpgg: (region: Region, players: { summonerName: string; tagLine: string }[]) => {
        set((state) => {
          const mainPlayers = players.slice(0, 5);
          const subPlayers = players.slice(5);

          const newMainRoster: Player[] = ROLES.map((role, index) => ({
            id: generateId(),
            summonerName: mainPlayers[index]?.summonerName || '',
            tagLine: mainPlayers[index]?.tagLine || '',
            role: role.value as Role,
            notes: '',
            region,
            isSub: false,
            championPool: [],
            championGroups: [],
          }));

          const newSubs: Player[] = subPlayers.map((p) => ({
            id: generateId(),
            summonerName: p.summonerName,
            tagLine: p.tagLine,
            role: 'mid' as Role,
            notes: '',
            region,
            isSub: true,
            championPool: [],
            championGroups: [],
          }));

          return updateSelectedTeam(state, (team) => ({
            ...team,
            players: [...newMainRoster, ...newSubs],
            updatedAt: Date.now(),
          }));
        });
      },

      addSub: () => {
        set((state) => {
          const defaultRegion = useSettingsStore.getState().defaultRegion;
          return updateSelectedTeam(state, (t) => ({
            ...t,
            players: [...t.players, createSubPlayer(defaultRegion)],
            updatedAt: Date.now(),
          }));
        });
      },

      removeSub: (playerId: string) => {
        set((state) =>
          updateSelectedTeam(state, (team) => ({
            ...team,
            players: team.players.filter((p) => p.id !== playerId),
            updatedAt: Date.now(),
          }))
        );
      },

      resetTeam: () => {
        set((state) => {
          const newTeam = createEmptyTeam('My Team');
          return updateSelectedTeam(state, () => ({
            ...newTeam,
            id: state.selectedTeamId, // Keep the same ID
          }));
        });
      },

      swapPlayerRoles: (playerId1: string, playerId2: string) => {
        set((state) =>
          updateSelectedTeam(state, (team) => {
            const players = [...team.players];
            const player1 = players.find((p) => p.id === playerId1);
            const player2 = players.find((p) => p.id === playerId2);

            if (!player1 || !player2) return team;

            const tempRole = player1.role;
            const tempIsSub = player1.isSub;
            player1.role = player2.role;
            player1.isSub = player2.isSub;
            player2.role = tempRole;
            player2.isSub = tempIsSub;

            return { ...team, players, updatedAt: Date.now() };
          })
        );
      },

      moveToRole: (playerId: string, role: Role) => {
        set((state) =>
          updateSelectedTeam(state, (team) => {
            const players = [...team.players];
            const player = players.find((p) => p.id === playerId);
            const existingPlayer = players.find((p) => p.role === role && !p.isSub);

            if (!player) return team;

            if (existingPlayer && existingPlayer.id !== playerId) {
              existingPlayer.role = player.role;
              existingPlayer.isSub = player.isSub;
            }

            player.role = role;
            player.isSub = false;

            return { ...team, players, updatedAt: Date.now() };
          })
        );
      },

      moveToSubs: (playerId: string) => {
        set((state) =>
          updateSelectedTeam(state, (team) => ({
            ...team,
            players: team.players.map((p) =>
              p.id === playerId ? { ...p, isSub: true } : p
            ),
            updatedAt: Date.now(),
          }))
        );
      },

      setChampionTier: (playerId: string, championId: string, tier: ChampionTier) => {
        set((state) =>
          updateSelectedTeam(state, (team) => ({
            ...team,
            players: team.players.map((p) => {
              if (p.id !== playerId) return p;
              const pool = p.championPool || [];
              const existingIndex = pool.findIndex((c) => c.championId === championId);
              if (existingIndex >= 0) {
                const newPool = [...pool];
                newPool[existingIndex] = { championId, tier };
                return { ...p, championPool: newPool };
              }
              return { ...p, championPool: [...pool, { championId, tier }] };
            }),
            updatedAt: Date.now(),
          }))
        );
      },

      removeChampionFromPool: (playerId: string, championId: string) => {
        set((state) =>
          updateSelectedTeam(state, (team) => ({
            ...team,
            players: team.players.map((p) => {
              if (p.id !== playerId) return p;
              return {
                ...p,
                championPool: (p.championPool || []).filter((c) => c.championId !== championId),
              };
            }),
            updatedAt: Date.now(),
          }))
        );
      },

      addChampionToGroup: (playerId: string, groupId: string, championId: string) => {
        set((state) =>
          updateSelectedTeam(state, (team) => ({
            ...team,
            players: team.players.map((p) => {
              if (p.id !== playerId) return p;
              const groups = p.championGroups || [];
              return {
                ...p,
                championGroups: groups.map((g) =>
                  g.id === groupId && !g.championIds.includes(championId)
                    ? { ...g, championIds: [...g.championIds, championId] }
                    : g
                ),
              };
            }),
            updatedAt: Date.now(),
          }))
        );
      },

      removeChampionFromGroup: (playerId: string, groupId: string, championId: string) => {
        set((state) =>
          updateSelectedTeam(state, (team) => ({
            ...team,
            players: team.players.map((p) => {
              if (p.id !== playerId) return p;
              const groups = p.championGroups || [];
              return {
                ...p,
                championGroups: groups.map((g) =>
                  g.id === groupId
                    ? { ...g, championIds: g.championIds.filter((id) => id !== championId) }
                    : g
                ),
              };
            }),
            updatedAt: Date.now(),
          }))
        );
      },

      moveChampion: (playerId: string, fromGroupId: string, toGroupId: string, championId: string, newIndex: number) => {
        set((state) =>
          updateSelectedTeam(state, (team) => ({
            ...team,
            players: team.players.map((p) => {
              if (p.id !== playerId) return p;
              const groups = (p.championGroups || []).map((g) => {
                if (g.id === fromGroupId) {
                  return { ...g, championIds: g.championIds.filter((id) => id !== championId) };
                }
                if (g.id === toGroupId) {
                  const newIds = g.championIds.filter((id) => id !== championId);
                  newIds.splice(newIndex, 0, championId);
                  return { ...g, championIds: newIds };
                }
                return g;
              });
              return { ...p, championGroups: groups };
            }),
            updatedAt: Date.now(),
          }))
        );
      },

      reorderChampionInGroup: (playerId: string, groupId: string, championId: string, newIndex: number) => {
        set((state) =>
          updateSelectedTeam(state, (team) => ({
            ...team,
            players: team.players.map((p) => {
              if (p.id !== playerId) return p;
              const groups = (p.championGroups || []).map((g) => {
                if (g.id !== groupId) return g;
                const newIds = g.championIds.filter((id) => id !== championId);
                newIds.splice(newIndex, 0, championId);
                return { ...g, championIds: newIds };
              });
              return { ...p, championGroups: groups };
            }),
            updatedAt: Date.now(),
          }))
        );
      },

      addGroup: (playerId: string, groupName: string) => {
        set((state) =>
          updateSelectedTeam(state, (team) => ({
            ...team,
            players: team.players.map((p) => {
              if (p.id !== playerId) return p;
              const groups = p.championGroups || [];
              return {
                ...p,
                championGroups: [...groups, { id: generateId(), name: groupName, championIds: [] }],
              };
            }),
            updatedAt: Date.now(),
          }))
        );
      },

      removeGroup: (playerId: string, groupId: string) => {
        set((state) =>
          updateSelectedTeam(state, (team) => ({
            ...team,
            players: team.players.map((p) => {
              if (p.id !== playerId) return p;
              const groups = p.championGroups || [];
              return { ...p, championGroups: groups.filter((g) => g.id !== groupId) };
            }),
            updatedAt: Date.now(),
          }))
        );
      },

      renameGroup: (playerId: string, groupId: string, newName: string) => {
        set((state) =>
          updateSelectedTeam(state, (team) => ({
            ...team,
            players: team.players.map((p) => {
              if (p.id !== playerId) return p;
              return {
                ...p,
                championGroups: (p.championGroups || []).map((g) =>
                  g.id === groupId ? { ...g, name: newName } : g
                ),
              };
            }),
            updatedAt: Date.now(),
          }))
        );
      },

      reorderGroups: (playerId: string, groupIds: string[]) => {
        set((state) =>
          updateSelectedTeam(state, (team) => ({
            ...team,
            players: team.players.map((p) => {
              if (p.id !== playerId) return p;
              const groups = p.championGroups || [];
              const reordered = groupIds
                .map((id) => groups.find((g) => g.id === id))
                .filter((g): g is NonNullable<typeof g> => g !== undefined);
              return { ...p, championGroups: reordered };
            }),
            updatedAt: Date.now(),
          }))
        );
      },

      addNote: () => {
        set((state) => {
          const newNote: Note = {
            id: generateId(),
            content: '',
            createdAt: Date.now(),
          };
          return updateSelectedTeam(state, (team) => ({
            ...team,
            notepad: [...(team.notepad || []), newNote],
            updatedAt: Date.now(),
          }));
        });
      },

      updateNote: (noteId: string, content: string) => {
        set((state) =>
          updateSelectedTeam(state, (team) => ({
            ...team,
            notepad: (team.notepad || []).map((note) =>
              note.id === noteId ? { ...note, content } : note
            ),
            updatedAt: Date.now(),
          }))
        );
      },

      deleteNote: (noteId: string) => {
        set((state) =>
          updateSelectedTeam(state, (team) => ({
            ...team,
            notepad: (team.notepad || []).filter((note) => note.id !== noteId),
            updatedAt: Date.now(),
          }))
        );
      },
    }),
      {
        storeKey: 'my-teams',
        tableName: 'my_teams',
        isArraySync: true,
        selectSyncData: (state) => state.teams,
        transformItem: (team: Team, userId: string, index: number) => ({
          id: team.id,
          user_id: userId,
          name: team.name,
          notes: team.notes,
          champion_pool: team.championPool || [],
          sort_order: index,
        }),
        // Sync players to the players table after team sync
        onAfterSync: (teams: Team[], storeKey: string, debounceMs: number) => {
          // Get champion pools from the separate store
          const { findPool } = usePlayerPoolStore.getState();

          teams.forEach((team) => {
            // Enrich players with their champion pools from usePlayerPoolStore
            const enrichedPlayers = team.players.map((player) => {
              // Look up pool by summoner name and role
              const pool = player.summonerName ? findPool(player.summonerName, player.role) : null;
              return {
                ...player,
                // Use pool's championGroups if available, otherwise keep player's (which may be empty)
                championGroups: pool?.championGroups || player.championGroups || [],
              };
            });

            syncManager.syncPlayersToCloud(storeKey, 'players', team.id, enrichedPlayers, {
              debounceMs,
            });
          });
        },
      }
    ),
    {
      name: 'teamcomp-lol-my-team',
      version: 4,
      migrate: (persistedState: unknown, version: number) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const state = persistedState as any;

        // Migration from v2 and earlier: convert championPool to TieredChampion format
        if (version < 2 && state?.team?.players) {
          state.team.players = state.team.players.map((p: Player) => ({
            ...p,
            championPool: (p.championPool || []).map((item: string | TieredChampion) =>
              typeof item === 'string' ? { championId: item, tier: 'A' as ChampionTier } : item
            ),
          }));
        }

        // Migration from v2 to v3: add championGroups
        if (version < 3 && state?.team?.players) {
          state.team.players = state.team.players.map((p: Player) => {
            const pool = p.championPool || [];
            const championIds = pool.map((c: TieredChampion) => c.championId);
            return {
              ...p,
              championGroups: [{ id: generateId(), name: 'Pool', championIds }],
            };
          });
        }

        // Migration from v3 to v4: convert single team to array
        if (version < 4 && state?.team) {
          return {
            teams: [state.team],
            selectedTeamId: state.team.id,
          };
        }

        return state;
      },
    }
  )
);
