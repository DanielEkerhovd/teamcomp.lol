import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Team, Player, createEmptyTeam, createSubPlayer, generateId, Region, Role, ROLES, ChampionTier, TieredChampion, Note } from '../types';
import { useSettingsStore } from './useSettingsStore';
import { cloudSync } from './middleware/cloudSync';
import { syncManager } from '../lib/syncManager';
import { useAuthStore } from './useAuthStore';
import { supabase } from '../lib/supabase';

// Maximum number of subs per team
export const MAX_SUBS = 5;

// Guest/free default for enemy teams
export const MAX_ENEMY_TEAMS_DEFAULT = 10;

// Get the maximum enemy teams allowed based on auth state
export const getMaxEnemyTeams = (): number => {
  const { user, profile } = useAuthStore.getState();
  if (!user) return MAX_ENEMY_TEAMS_DEFAULT;
  return profile?.maxEnemyTeams ?? MAX_ENEMY_TEAMS_DEFAULT;
};

// Result type for team operations that can fail
export interface EnemyTeamOperationResult {
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

interface EnemyTeamState {
  teams: Team[];
  // Team enemy teams - shared across team members, keyed by myTeamId
  teamEnemyTeams: Record<string, Team[]>;
  teamEnemyTeamsLoading: boolean;
  addTeam: (name: string) => EnemyTeamOperationResult;
  isTeamNameAvailable: (name: string, excludeTeamId?: string) => boolean;
  importTeamFromOpgg: (name: string, region: Region, players: { summonerName: string; tagLine: string }[]) => EnemyTeamOperationResult;
  importPlayersToTeam: (teamId: string, region: Region, players: { summonerName: string; tagLine: string }[]) => void;
  updateTeam: (id: string, updates: Partial<Omit<Team, 'id' | 'createdAt'>>) => { success: boolean; error?: 'duplicate_name' };
  deleteTeam: (id: string) => void;
  toggleFavorite: (id: string) => void;
  updatePlayer: (teamId: string, playerId: string, updates: Partial<Omit<Player, 'id'>>) => void;
  addSub: (teamId: string) => void;
  removeSub: (teamId: string, playerId: string) => void;
  getTeam: (id: string) => Team | undefined;
  // Team enemy team operations
  loadTeamEnemyTeams: (myTeamId: string) => Promise<void>;
  addTeamEnemyTeam: (myTeamId: string, name: string) => Promise<EnemyTeamOperationResult>;
  deleteTeamEnemyTeam: (myTeamId: string, enemyTeamId: string) => Promise<void>;
  getTeamEnemyTeam: (myTeamId: string, enemyTeamId: string) => Team | undefined;
  // Drag-based role management
  swapPlayerRoles: (teamId: string, playerId1: string, playerId2: string) => void;
  moveToRole: (teamId: string, playerId: string, role: Role) => void;
  moveToSubs: (teamId: string, playerId: string) => void;
  setPlayerChampionTier: (teamId: string, playerId: string, championId: string, tier: ChampionTier) => void;
  removePlayerChampion: (teamId: string, playerId: string, championId: string) => void;
  // Group-based champion management
  addChampionToGroup: (teamId: string, playerId: string, groupId: string, championId: string) => void;
  removeChampionFromGroup: (teamId: string, playerId: string, groupId: string, championId: string) => void;
  moveChampion: (teamId: string, playerId: string, fromGroupId: string, toGroupId: string, championId: string, newIndex: number) => void;
  reorderChampionInGroup: (teamId: string, playerId: string, groupId: string, championId: string, newIndex: number) => void;
  addGroup: (teamId: string, playerId: string, groupName: string) => void;
  removeGroup: (teamId: string, playerId: string, groupId: string) => void;
  renameGroup: (teamId: string, playerId: string, groupId: string, newName: string) => void;
  reorderGroups: (teamId: string, playerId: string, groupIds: string[]) => void;
  setAllowDuplicateChampions: (teamId: string, playerId: string, allowDuplicates: boolean) => void;
  // Team notepad management
  addNote: (teamId: string) => void;
  updateNote: (teamId: string, noteId: string, content: string) => void;
  deleteNote: (teamId: string, noteId: string) => void;
  // Player notepad management
  addPlayerNote: (teamId: string, playerId: string) => void;
  updatePlayerNote: (teamId: string, playerId: string, noteId: string, content: string) => void;
  deletePlayerNote: (teamId: string, playerId: string, noteId: string) => void;
}

export const useEnemyTeamStore = create<EnemyTeamState>()(
  persist(
    cloudSync(
      (set, get) => ({
        teams: [],
        teamEnemyTeams: {},
        teamEnemyTeamsLoading: false,

      addTeam: (name: string): EnemyTeamOperationResult => {
        const currentTeams = get().teams;
        const maxEnemyTeams = getMaxEnemyTeams();
        if (currentTeams.length >= maxEnemyTeams) {
          return { success: false, error: 'max_teams_reached' };
        }
        if (isTeamNameTaken(currentTeams, name)) {
          return { success: false, error: 'duplicate_name' };
        }
        const newTeam = createEmptyTeam(name);
        set((state) => ({ teams: [...state.teams, newTeam] }));
        return { success: true, team: newTeam };
      },

      isTeamNameAvailable: (name: string, excludeTeamId?: string): boolean => {
        const state = get();
        return !isTeamNameTaken(state.teams, name, excludeTeamId);
      },

      importTeamFromOpgg: (name: string, region: Region, players: { summonerName: string; tagLine: string }[]): EnemyTeamOperationResult => {
        const currentTeams = get().teams;
        const maxEnemyTeams = getMaxEnemyTeams();
        if (currentTeams.length >= maxEnemyTeams) {
          return { success: false, error: 'max_teams_reached' };
        }
        if (isTeamNameTaken(currentTeams, name)) {
          return { success: false, error: 'duplicate_name' };
        }
        const newTeam = createEmptyTeam(name);

        // Assign first 5 players to main roster roles
        const mainPlayers = players.slice(0, 5);
        const subPlayers = players.slice(5);

        // Update main roster
        newTeam.players = ROLES.map((role, index) => ({
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

        // Add subs if there are more than 5 players
        subPlayers.forEach((p) => {
          newTeam.players.push({
            id: generateId(),
            summonerName: p.summonerName,
            tagLine: p.tagLine,
            role: 'mid', // default role for subs
            notes: '',
            region,
            isSub: true,
            championPool: [],
            championGroups: [],
          });
        });

        set((state) => ({ teams: [...state.teams, newTeam] }));
        return { success: true, team: newTeam };
      },

      importPlayersToTeam: (teamId: string, region: Region, players: { summonerName: string; tagLine: string }[]) => {
        set((state) => ({
          teams: state.teams.map((team) => {
            if (team.id !== teamId) return team;

            const mainPlayers = players.slice(0, 5);
            const subPlayers = players.slice(5);

            // Update main roster - preserve champion pools if player name matches
            const newMainRoster = ROLES.map((role, index) => {
              const existingPlayer = team.players.find(p => !p.isSub && p.role === role.value);
              const newPlayerData = mainPlayers[index];

              return {
                id: existingPlayer?.id || generateId(),
                summonerName: newPlayerData?.summonerName || '',
                tagLine: newPlayerData?.tagLine || '',
                role: role.value as Role,
                notes: existingPlayer?.notes || '',
                region,
                isSub: false,
                championPool: existingPlayer?.championPool || [],
                championGroups: existingPlayer?.championGroups || [],
              };
            });

            // Add new subs from import (keep existing subs)
            const existingSubs = team.players.filter(p => p.isSub);
            const newSubs = subPlayers.map((p) => ({
              id: generateId(),
              summonerName: p.summonerName,
              tagLine: p.tagLine,
              role: 'mid' as Role,
              notes: '',
              region,
              isSub: true,
              championPool: [] as typeof existingSubs[0]['championPool'],
              championGroups: [] as typeof existingSubs[0]['championGroups'],
            }));

            return {
              ...team,
              players: [...newMainRoster, ...existingSubs, ...newSubs],
              updatedAt: Date.now(),
            };
          }),
        }));
      },

      updateTeam: (id: string, updates: Partial<Omit<Team, 'id' | 'createdAt'>>): { success: boolean; error?: 'duplicate_name' } => {
        const state = get();
        // Check for duplicate name if name is being updated
        if (updates.name !== undefined) {
          if (isTeamNameTaken(state.teams, updates.name, id)) {
            return { success: false, error: 'duplicate_name' };
          }
        }
        set((state) => ({
          teams: state.teams.map((team) =>
            team.id === id
              ? { ...team, ...updates, updatedAt: Date.now() }
              : team
          ),
        }));
        return { success: true };
      },

      deleteTeam: (id: string) => {
        set((state) => ({
          teams: state.teams.filter((team) => team.id !== id),
        }));
      },

      toggleFavorite: (id: string) => {
        set((state) => ({
          teams: state.teams.map((team) =>
            team.id === id ? { ...team, isFavorite: !team.isFavorite } : team
          ),
        }));
      },

      updatePlayer: (teamId: string, playerId: string, updates: Partial<Omit<Player, 'id'>>) => {
        set((state) => ({
          teams: state.teams.map((team) =>
            team.id === teamId
              ? {
                  ...team,
                  players: team.players.map((player) =>
                    player.id === playerId ? { ...player, ...updates } : player
                  ),
                  updatedAt: Date.now(),
                }
              : team
          ),
        }));
      },

      addSub: (teamId: string) => {
        set((state) => ({
          teams: state.teams.map((team) => {
            if (team.id !== teamId) return team;
            const currentSubs = team.players.filter((p) => p.isSub).length;
            if (currentSubs >= MAX_SUBS) return team;

            const defaultRegion = useSettingsStore.getState().defaultRegion;
            return {
              ...team,
              players: [...team.players, createSubPlayer(defaultRegion)],
              updatedAt: Date.now(),
            };
          }),
        }));
      },

      removeSub: (teamId: string, playerId: string) => {
        set((state) => ({
          teams: state.teams.map((team) => {
            if (team.id !== teamId) return team;
            return {
              ...team,
              players: team.players.filter((p) => p.id !== playerId),
              updatedAt: Date.now(),
            };
          }),
        }));
      },

      swapPlayerRoles: (teamId: string, playerId1: string, playerId2: string) => {
        set((state) => ({
          teams: state.teams.map((team) => {
            if (team.id !== teamId) return team;
            const players = [...team.players];
            const player1 = players.find((p) => p.id === playerId1);
            const player2 = players.find((p) => p.id === playerId2);

            if (!player1 || !player2) return team;

            // Swap roles and isSub status
            const tempRole = player1.role;
            const tempIsSub = player1.isSub;
            player1.role = player2.role;
            player1.isSub = player2.isSub;
            player2.role = tempRole;
            player2.isSub = tempIsSub;

            return { ...team, players, updatedAt: Date.now() };
          }),
        }));
      },

      moveToRole: (teamId: string, playerId: string, role: Role) => {
        set((state) => ({
          teams: state.teams.map((team) => {
            if (team.id !== teamId) return team;
            const players = [...team.players];
            const player = players.find((p) => p.id === playerId);
            const existingPlayer = players.find((p) => p.role === role && !p.isSub);

            if (!player) return team;

            // If there's already a player in this role, swap them
            if (existingPlayer && existingPlayer.id !== playerId) {
              existingPlayer.role = player.role;
              existingPlayer.isSub = player.isSub;
            }

            player.role = role;
            player.isSub = false;

            return { ...team, players, updatedAt: Date.now() };
          }),
        }));
      },

      moveToSubs: (teamId: string, playerId: string) => {
        set((state) => ({
          teams: state.teams.map((team) => {
            if (team.id !== teamId) return team;
            return {
              ...team,
              players: team.players.map((p) =>
                p.id === playerId ? { ...p, isSub: true } : p
              ),
              updatedAt: Date.now(),
            };
          }),
        }));
      },

      getTeam: (id: string) => {
        return get().teams.find((team) => team.id === id);
      },

      setPlayerChampionTier: (teamId: string, playerId: string, championId: string, tier: ChampionTier) => {
        set((state) => ({
          teams: state.teams.map((team) => {
            if (team.id !== teamId) return team;
            return {
              ...team,
              players: team.players.map((player) => {
                if (player.id !== playerId) return player;
                const pool = player.championPool || [];
                const existingIndex = pool.findIndex((c) => c.championId === championId);
                if (existingIndex >= 0) {
                  const newPool = [...pool];
                  newPool[existingIndex] = { championId, tier };
                  return { ...player, championPool: newPool };
                }
                return { ...player, championPool: [...pool, { championId, tier }] };
              }),
              updatedAt: Date.now(),
            };
          }),
        }));
      },

      removePlayerChampion: (teamId: string, playerId: string, championId: string) => {
        set((state) => ({
          teams: state.teams.map((team) => {
            if (team.id !== teamId) return team;
            return {
              ...team,
              players: team.players.map((player) => {
                if (player.id !== playerId) return player;
                return {
                  ...player,
                  championPool: (player.championPool || []).filter((c) => c.championId !== championId),
                };
              }),
              updatedAt: Date.now(),
            };
          }),
        }));
      },

      addChampionToGroup: (teamId: string, playerId: string, groupId: string, championId: string) => {
        set((state) => ({
          teams: state.teams.map((team) => {
            if (team.id !== teamId) return team;
            return {
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
            };
          }),
        }));
      },

      removeChampionFromGroup: (teamId: string, playerId: string, groupId: string, championId: string) => {
        set((state) => ({
          teams: state.teams.map((team) => {
            if (team.id !== teamId) return team;
            return {
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
            };
          }),
        }));
      },

      moveChampion: (teamId: string, playerId: string, fromGroupId: string, toGroupId: string, championId: string, newIndex: number) => {
        set((state) => ({
          teams: state.teams.map((team) => {
            if (team.id !== teamId) return team;
            return {
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
            };
          }),
        }));
      },

      reorderChampionInGroup: (teamId: string, playerId: string, groupId: string, championId: string, newIndex: number) => {
        set((state) => ({
          teams: state.teams.map((team) => {
            if (team.id !== teamId) return team;
            return {
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
            };
          }),
        }));
      },

      addGroup: (teamId: string, playerId: string, groupName: string) => {
        set((state) => ({
          teams: state.teams.map((team) => {
            if (team.id !== teamId) return team;
            return {
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
            };
          }),
        }));
      },

      removeGroup: (teamId: string, playerId: string, groupId: string) => {
        set((state) => ({
          teams: state.teams.map((team) => {
            if (team.id !== teamId) return team;
            return {
              ...team,
              players: team.players.map((p) => {
                if (p.id !== playerId) return p;
                const groups = p.championGroups || [];
                // Simply remove the group - champions return to the pool
                return { ...p, championGroups: groups.filter((g) => g.id !== groupId) };
              }),
              updatedAt: Date.now(),
            };
          }),
        }));
      },

      renameGroup: (teamId: string, playerId: string, groupId: string, newName: string) => {
        set((state) => ({
          teams: state.teams.map((team) => {
            if (team.id !== teamId) return team;
            return {
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
            };
          }),
        }));
      },

      reorderGroups: (teamId: string, playerId: string, groupIds: string[]) => {
        set((state) => ({
          teams: state.teams.map((team) => {
            if (team.id !== teamId) return team;
            return {
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
            };
          }),
        }));
      },

      setAllowDuplicateChampions: (teamId: string, playerId: string, allowDuplicates: boolean) => {
        set((state) => ({
          teams: state.teams.map((team) => {
            if (team.id !== teamId) return team;
            return {
              ...team,
              players: team.players.map((p) => {
                if (p.id !== playerId) return p;
                return { ...p, allowDuplicateChampions: allowDuplicates };
              }),
              updatedAt: Date.now(),
            };
          }),
        }));
      },

      addNote: (teamId: string) => {
        set((state) => ({
          teams: state.teams.map((team) => {
            if (team.id !== teamId) return team;
            const newNote: Note = {
              id: generateId(),
              content: '',
              createdAt: Date.now(),
            };
            return {
              ...team,
              notepad: [...(team.notepad || []), newNote],
              updatedAt: Date.now(),
            };
          }),
        }));
      },

      updateNote: (teamId: string, noteId: string, content: string) => {
        set((state) => ({
          teams: state.teams.map((team) => {
            if (team.id !== teamId) return team;
            return {
              ...team,
              notepad: (team.notepad || []).map((note) =>
                note.id === noteId ? { ...note, content } : note
              ),
              updatedAt: Date.now(),
            };
          }),
        }));
      },

      deleteNote: (teamId: string, noteId: string) => {
        set((state) => ({
          teams: state.teams.map((team) => {
            if (team.id !== teamId) return team;
            return {
              ...team,
              notepad: (team.notepad || []).filter((note) => note.id !== noteId),
              updatedAt: Date.now(),
            };
          }),
        }));
      },

      addPlayerNote: (teamId: string, playerId: string) => {
        set((state) => ({
          teams: state.teams.map((team) => {
            if (team.id !== teamId) return team;
            return {
              ...team,
              players: team.players.map((p) => {
                if (p.id !== playerId) return p;
                const newNote = {
                  id: generateId(),
                  content: '',
                  createdAt: Date.now(),
                };
                return { ...p, notepad: [...(p.notepad || []), newNote] };
              }),
              updatedAt: Date.now(),
            };
          }),
        }));
      },

      updatePlayerNote: (teamId: string, playerId: string, noteId: string, content: string) => {
        set((state) => ({
          teams: state.teams.map((team) => {
            if (team.id !== teamId) return team;
            return {
              ...team,
              players: team.players.map((p) => {
                if (p.id !== playerId) return p;
                return {
                  ...p,
                  notepad: (p.notepad || []).map((note) =>
                    note.id === noteId ? { ...note, content } : note
                  ),
                };
              }),
              updatedAt: Date.now(),
            };
          }),
        }));
      },

      deletePlayerNote: (teamId: string, playerId: string, noteId: string) => {
        set((state) => ({
          teams: state.teams.map((team) => {
            if (team.id !== teamId) return team;
            return {
              ...team,
              players: team.players.map((p) => {
                if (p.id !== playerId) return p;
                return {
                  ...p,
                  notepad: (p.notepad || []).filter((note) => note.id !== noteId),
                };
              }),
              updatedAt: Date.now(),
            };
          }),
        }));
      },

      // --- Team enemy team operations (DB-only, not cloud synced) ---

      loadTeamEnemyTeams: async (myTeamId: string) => {
        if (!supabase) return;
        set({ teamEnemyTeamsLoading: true });
        try {
          const { data, error } = await (supabase
            .from('enemy_teams' as 'profiles')
            .select('*')
            .eq('team_id', myTeamId)
            .order('created_at', { ascending: true }) as unknown as Promise<{ data: Array<{
              id: string; name: string; notes: string; team_id: string;
              is_favorite: boolean; created_at: string; updated_at: string;
            }> | null; error: Error | null }>);

          if (error) throw error;

          const teams: Team[] = (data || []).map(row => ({
            id: row.id,
            name: row.name,
            notes: row.notes || '',
            isFavorite: row.is_favorite || false,
            players: ROLES.map(role => ({
              id: generateId(), summonerName: '', tagLine: '', role: role.value as Role,
              notes: '', region: 'euw' as Region, isSub: false, championPool: [], championGroups: [],
            })),
            createdAt: new Date(row.created_at).getTime(),
            updatedAt: new Date(row.updated_at).getTime(),
          }));

          set(state => ({
            teamEnemyTeams: { ...state.teamEnemyTeams, [myTeamId]: teams },
            teamEnemyTeamsLoading: false,
          }));
        } catch (err) {
          console.error('Error loading team enemy teams:', err);
          set({ teamEnemyTeamsLoading: false });
        }
      },

      addTeamEnemyTeam: async (myTeamId: string, name: string): Promise<EnemyTeamOperationResult> => {
        if (!supabase) return { success: false, error: 'max_teams_reached' };
        const { user } = useAuthStore.getState();
        if (!user) return { success: false, error: 'max_teams_reached' };

        const newId = generateId();
        try {
          const { error } = await (supabase
            .from('enemy_teams' as 'profiles')
            .insert({
              id: newId,
              user_id: user.id,
              name: name.trim(),
              notes: '',
              team_id: myTeamId,
            } as never) as unknown as Promise<{ error: Error | null }>);

          if (error) {
            if (error.message?.includes('limit reached')) {
              return { success: false, error: 'max_teams_reached' };
            }
            throw error;
          }

          const newTeam = createEmptyTeam(name);
          newTeam.id = newId;

          set(state => ({
            teamEnemyTeams: {
              ...state.teamEnemyTeams,
              [myTeamId]: [...(state.teamEnemyTeams[myTeamId] || []), newTeam],
            },
          }));

          return { success: true, team: newTeam };
        } catch (err) {
          console.error('Error adding team enemy team:', err);
          return { success: false, error: 'max_teams_reached' };
        }
      },

      deleteTeamEnemyTeam: async (myTeamId: string, enemyTeamId: string) => {
        if (!supabase) return;
        try {
          await (supabase
            .from('enemy_teams' as 'profiles')
            .delete()
            .eq('id', enemyTeamId) as unknown as Promise<{ error: Error | null }>);

          set(state => ({
            teamEnemyTeams: {
              ...state.teamEnemyTeams,
              [myTeamId]: (state.teamEnemyTeams[myTeamId] || []).filter(t => t.id !== enemyTeamId),
            },
          }));
        } catch (err) {
          console.error('Error deleting team enemy team:', err);
        }
      },

      getTeamEnemyTeam: (myTeamId: string, enemyTeamId: string): Team | undefined => {
        return get().teamEnemyTeams[myTeamId]?.find(t => t.id === enemyTeamId);
      },
    }),
      {
        storeKey: 'enemy-teams',
        tableName: 'enemy_teams',
        isArraySync: true,
        selectSyncData: (state) => state.teams,
        transformItem: (team: Team, userId: string, index: number) => ({
          id: team.id,
          user_id: userId,
          name: team.name,
          notes: team.notes,
          is_favorite: team.isFavorite ?? false,
        }),
        // Sync players to the enemy_players table after team sync
        onAfterSync: (teams: Team[], storeKey: string, debounceMs: number) => {
          teams.forEach((team) => {
            syncManager.syncPlayersToCloud(storeKey, 'enemy_players', team.id, team.players, {
              debounceMs,
            });
          });
        },
      }
    ),
    {
      name: 'teamcomp-lol-enemy-teams',
    }
  )
);
