import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Team, Player, createEmptyTeam, createSubPlayer, generateId, Region, Role, ROLES, ChampionTier, TieredChampion, Note } from '../types';
import { useSettingsStore } from './useSettingsStore';
import { useAuthStore } from './useAuthStore';
import { cloudSync } from './middleware/cloudSync';
import { syncManager } from '../lib/syncManager';
import { usePlayerPoolStore } from './usePlayerPoolStore';
import { teamMembershipService } from '../lib/teamMembershipService';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { TeamMembership, TeamMemberRole } from '../types/database';

// Guest mode limit (MAX_TEAMS exported for backward compatibility)
export const MAX_TEAMS_GUEST = 3;
export const MAX_TEAMS = MAX_TEAMS_GUEST;

// Maximum number of subs per team
export const MAX_SUBS = 5;

// Get the maximum teams allowed based on auth state
export const getMaxTeams = (): number => {
  const { user, profile } = useAuthStore.getState();
  if (!user) return MAX_TEAMS_GUEST; // Guest mode
  return profile?.maxTeams ?? 1; // Authenticated: use tier limit
};

// Permissions for a specific team
export interface TeamPermissions {
  canView: boolean;
  canEditTeamInfo: boolean;
  canManageMembers: boolean;
  canEditAllPlayers: boolean;
  canEditOwnPlayer: boolean;
  canEditGroups: boolean;
  canLeave: boolean;
  role: TeamMemberRole;
  playerSlotId: string | null;
}

// Result type for team operations that can fail
export interface TeamOperationResult {
  success: boolean;
  team?: Team;
  error?: 'duplicate_name' | 'max_teams_reached';
}

// Helper to check if a team name is taken (case-insensitive)
const isTeamNameTaken = (teams: Team[], name: string, excludeTeamId?: string): boolean => {
  const normalizedName = name.trim().toLowerCase();
  return teams.some(
    (t) => t.id !== excludeTeamId && t.name.trim().toLowerCase() === normalizedName
  );
};

interface MyTeamState {
  teams: Team[];
  selectedTeamId: string;
  // Memberships - teams user is a member of (not owner)
  memberships: TeamMembership[];
  membershipsLoading: boolean;
  membershipsError: string | null;
  // Membership team data - full team data loaded from DB for the selected membership team
  membershipTeamData: Team | null;
  membershipTeamLoading: boolean;
  // Team management
  addTeam: (name: string) => TeamOperationResult;
  deleteTeam: (id: string) => void;
  selectTeam: (id: string) => void;
  isTeamNameAvailable: (name: string, excludeTeamId?: string) => boolean;
  checkTeamNameGloballyAvailable: (name: string, excludeTeamId?: string) => Promise<{ available: boolean; error?: string }>;
  // Membership management
  loadMemberships: () => Promise<void>;
  loadMembershipTeamData: (teamId: string) => Promise<void>;
  leaveTeam: (teamId: string) => Promise<{ success: boolean; error?: string }>;
  getMyPermissions: (teamId: string) => TeamPermissions;
  // Existing actions (operate on selected team)
  updateTeam: (updates: Partial<Omit<Team, 'id' | 'createdAt'>>) => { success: boolean; error?: 'duplicate_name' };
  updatePlayer: (playerId: string, updates: Partial<Omit<Player, 'id'>>) => void;
  importFromOpgg: (region: Region, players: { summonerName: string; tagLine: string }[]) => { added: number; duplicates: number; overflow: number };
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

export const useMyTeamStore = create<MyTeamState>()(
  persist(
    cloudSync(
      (set, get) => ({
        teams: [],
        selectedTeamId: '',
        memberships: [],
        membershipsLoading: false,
        membershipsError: null,
        membershipTeamData: null,
        membershipTeamLoading: false,

      loadMembershipTeamData: async (teamId: string) => {
        set({ membershipTeamLoading: true, membershipTeamData: null });
        try {
          const data = await teamMembershipService.fetchTeamData(teamId);
          set({ membershipTeamData: data, membershipTeamLoading: false });
        } catch {
          set({ membershipTeamData: null, membershipTeamLoading: false });
        }
      },

      loadMemberships: async () => {
        set({ membershipsLoading: true, membershipsError: null });
        try {
          const memberships = await teamMembershipService.getTeamMemberships();
          set({ memberships, membershipsLoading: false });
        } catch (error) {
          set({
            membershipsError: error instanceof Error ? error.message : 'Failed to load memberships',
            membershipsLoading: false,
          });
        }
      },

      leaveTeam: async (teamId: string) => {
        const membership = get().memberships.find((m) => m.teamId === teamId);

        // Optimistic: remove from memberships immediately
        set((state) => ({
          memberships: state.memberships.filter((m) => m.teamId !== teamId),
        }));

        const result = await teamMembershipService.leaveTeam(teamId);
        if (!result.success && membership) {
          // Revert on failure
          set((state) => ({
            memberships: [...state.memberships, membership],
          }));
        }
        return result;
      },

      getMyPermissions: (teamId: string): TeamPermissions => {
        const state = get();
        const { user } = useAuthStore.getState();

        // Check if user owns this team
        const ownedTeam = state.teams.find((t) => t.id === teamId);
        if (ownedTeam) {
          return {
            canView: true,
            canEditTeamInfo: true,
            canManageMembers: true,
            canEditAllPlayers: true,
            canEditOwnPlayer: true,
            canEditGroups: true,
            canLeave: false, // Owner cannot leave, must transfer
            role: 'owner',
            playerSlotId: null,
          };
        }

        // Check if user is a member of this team
        const membership = state.memberships.find((m) => m.teamId === teamId);
        if (membership) {
          const isAdmin = membership.role === 'admin';
          const isPlayer = membership.role === 'player';

          return {
            canView: true,
            canEditTeamInfo: isAdmin,
            canManageMembers: isAdmin,
            canEditAllPlayers: isAdmin,
            canEditOwnPlayer: isPlayer && !!membership.playerSlotId,
            canEditGroups: membership.canEditGroups,
            canLeave: true,
            role: membership.role,
            playerSlotId: membership.playerSlotId,
          };
        }

        // No access
        return {
          canView: false,
          canEditTeamInfo: false,
          canManageMembers: false,
          canEditAllPlayers: false,
          canEditOwnPlayer: false,
          canEditGroups: false,
          canLeave: false,
          role: 'viewer',
          playerSlotId: null,
        };
      },

      addTeam: (name: string): TeamOperationResult => {
        const state = get();
        const maxTeams = getMaxTeams();
        if (state.teams.length >= maxTeams) {
          return { success: false, error: 'max_teams_reached' };
        }
        if (isTeamNameTaken(state.teams, name)) {
          return { success: false, error: 'duplicate_name' };
        }
        const newTeam = createEmptyTeam(name);
        set({ teams: [...state.teams, newTeam], selectedTeamId: newTeam.id });
        return { success: true, team: newTeam };
      },

      isTeamNameAvailable: (name: string, excludeTeamId?: string): boolean => {
        const state = get();
        return !isTeamNameTaken(state.teams, name, excludeTeamId);
      },

      checkTeamNameGloballyAvailable: async (name: string, excludeTeamId?: string): Promise<{ available: boolean; error?: string }> => {
        // First check locally
        const state = get();
        if (isTeamNameTaken(state.teams, name, excludeTeamId)) {
          return { available: false };
        }

        // Then check database for global uniqueness
        if (!isSupabaseConfigured() || !supabase) {
          return { available: true }; // Can't check, assume available (local-only mode)
        }

        try {
          const trimmedName = name.trim();

          // Use the database function that bypasses RLS to check all teams
          const { data, error } = await supabase.rpc('check_team_name_available', {
            team_name: trimmedName,
            exclude_team_id: excludeTeamId || null,
          });

          if (error) {
            console.error('Error checking team name availability:', error);
            // Return false with error message - don't silently fail
            return { available: false, error: 'Could not verify team name availability. Please try again.' };
          }

          // The function returns true if available, false if taken
          return { available: data === true };
        } catch (error) {
          console.error('Error checking team name availability:', error);
          return { available: false, error: 'Could not verify team name availability. Please try again.' };
        }
      },

      deleteTeam: (id: string) => {
        const state = get();
        const newTeams = state.teams.filter((t) => t.id !== id);
        const newSelectedId =
          state.selectedTeamId === id
            ? (newTeams[0]?.id || '')
            : state.selectedTeamId;
        set({ teams: newTeams, selectedTeamId: newSelectedId });
      },

      selectTeam: (id: string) => {
        const state = get();
        // Allow selecting owned teams or membership teams
        const isOwnedTeam = state.teams.some((t) => t.id === id);
        const isMembershipTeam = state.memberships.some((m) => m.teamId === id);
        if (isOwnedTeam) {
          set({ selectedTeamId: id, membershipTeamData: null });
        } else if (isMembershipTeam) {
          set({ selectedTeamId: id });
          // Load the full team data from the database
          get().loadMembershipTeamData(id);
        }
      },

      updateTeam: (updates: Partial<Omit<Team, 'id' | 'createdAt'>>): { success: boolean; error?: 'duplicate_name' } => {
        const state = get();
        // Check for duplicate name if name is being updated
        if (updates.name !== undefined) {
          if (isTeamNameTaken(state.teams, updates.name, state.selectedTeamId)) {
            return { success: false, error: 'duplicate_name' };
          }
        }
        set((state) =>
          updateSelectedTeam(state, (team) => ({
            ...team,
            ...updates,
            updatedAt: Date.now(),
          }))
        );
        return { success: true };
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
        const state = get();
        const selectedTeam = state.teams.find((t) => t.id === state.selectedTeamId);
        if (!selectedTeam) return { added: 0, duplicates: 0, overflow: 0 };

        const existingMain = selectedTeam.players.filter((p) => !p.isSub);
        const existingSubs = selectedTeam.players.filter((p) => p.isSub);

        // Build set of existing summoner names (lowercase) for duplicate detection
        const existingNames = new Set(
          selectedTeam.players
            .filter((p) => p.summonerName)
            .map((p) => p.summonerName.toLowerCase())
        );

        // Filter out duplicates
        const uniquePlayers = players.filter(
          (p) => !existingNames.has(p.summonerName.toLowerCase())
        );
        const duplicates = players.length - uniquePlayers.length;

        // Find empty main roster slots (roles without a summoner name)
        const emptyMainSlots = existingMain.filter((p) => !p.summonerName);
        const availableSubSlots = MAX_SUBS - existingSubs.length;

        let added = 0;
        let remaining = [...uniquePlayers];
        const updatedPlayers = [...selectedTeam.players];

        // Fill empty main roster slots first
        for (const slot of emptyMainSlots) {
          if (remaining.length === 0) break;
          const incoming = remaining.shift()!;
          const idx = updatedPlayers.findIndex((p) => p.id === slot.id);
          updatedPlayers[idx] = {
            ...updatedPlayers[idx],
            summonerName: incoming.summonerName,
            tagLine: incoming.tagLine,
            region,
          };
          added++;
        }

        // Fill sub slots with the rest
        const subsToAdd = remaining.slice(0, availableSubSlots);
        const overflow = remaining.length - subsToAdd.length;

        for (const p of subsToAdd) {
          updatedPlayers.push({
            id: generateId(),
            summonerName: p.summonerName,
            tagLine: p.tagLine,
            role: 'mid' as Role,
            notes: '',
            region,
            isSub: true,
            championPool: [],
            championGroups: [],
          });
          added++;
        }

        set((state) =>
          updateSelectedTeam(state, (team) => ({
            ...team,
            players: updatedPlayers,
            updatedAt: Date.now(),
          }))
        );

        return { added, duplicates, overflow };
      },

      addSub: () => {
        set((state) => {
          const selectedTeam = state.teams.find((t) => t.id === state.selectedTeamId);
          const currentSubs = selectedTeam?.players.filter((p) => p.isSub).length || 0;
          if (currentSubs >= MAX_SUBS) return state;

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
          // Get champion pools from the separate store - use pools directly for more control
          const { pools } = usePlayerPoolStore.getState();

          teams.forEach((team) => {
            // Enrich players with their champion pools from usePlayerPoolStore
            const enrichedPlayers = team.players.map((player) => {
              // Look up pool by summoner name (case-insensitive) and role
              const normalizedName = player.summonerName?.toLowerCase().trim() || '';
              const pool = normalizedName
                ? pools.find(
                    (p) => (p.summonerName?.toLowerCase().trim() || '') === normalizedName && p.role === player.role
                  )
                : undefined;

              // Merge champion groups: prefer pool groups if they have content
              const poolGroups = pool?.championGroups || [];
              const playerGroups = player.championGroups || [];
              const championGroups = poolGroups.length > 0 ? poolGroups : playerGroups;

              return {
                ...player,
                championGroups,
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
      partialize: (state) => ({
        teams: state.teams,
        selectedTeamId: state.selectedTeamId,
        memberships: state.memberships,
      }),
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
