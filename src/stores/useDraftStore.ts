import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ChampionGroup, DraftSession, generateId, Note } from '../types';
import { cloudSync } from './middleware/cloudSync';

// Helper to validate UUID format for database FK references
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isValidUUID = (id: string | null | undefined): boolean => {
  if (!id) return false;
  return UUID_REGEX.test(id);
};

// Helper to migrate old flat arrays to new group format
// This is a ONE-TIME migration - once groups exist, legacy fields are ignored
function migrateSession(session: DraftSession): DraftSession {
  const migrated = { ...session };

  // Check if this session has EVER had groups (even if now empty)
  // We use a flag to track if migration has happened
  const hasBeenMigrated = session.banGroups !== undefined || session.priorityGroups !== undefined;

  // Migrate potentialBans to banGroups if this is an old session that was never migrated
  if (!hasBeenMigrated && migrated.potentialBans && migrated.potentialBans.length > 0) {
    migrated.banGroups = [{
      id: generateId(),
      name: 'Bans',
      championIds: [...migrated.potentialBans],
    }];
  } else if (!migrated.banGroups) {
    migrated.banGroups = [];
  }

  // Migrate ourPriorities to priorityGroups if this is an old session that was never migrated
  if (!hasBeenMigrated && migrated.ourPriorities && migrated.ourPriorities.length > 0) {
    migrated.priorityGroups = [{
      id: generateId(),
      name: 'Priorities',
      championIds: [...migrated.ourPriorities],
    }];
  } else if (!migrated.priorityGroups) {
    migrated.priorityGroups = [];
  }

  // Clear legacy fields after migration to prevent re-migration
  delete migrated.potentialBans;
  delete migrated.ourPriorities;

  return migrated;
}

// Helper to get all champion IDs from groups (for backwards compatibility)
function getAllChampionIds(groups: ChampionGroup[]): string[] {
  return groups.flatMap(g => g.championIds);
}

interface DraftState {
  sessions: DraftSession[];
  currentSessionId: string | null;

  // Session management
  createSession: (name: string, enemyTeamId?: string, myTeamId?: string) => DraftSession;
  updateSession: (id: string, updates: Partial<Omit<DraftSession, 'id' | 'createdAt'>>) => void;
  deleteSession: (id: string) => void;
  setCurrentSession: (id: string | null) => void;
  getCurrentSession: () => DraftSession | undefined;

  // Ban group actions
  addBanGroup: (name: string) => void;
  renameBanGroup: (groupId: string, name: string) => void;
  deleteBanGroup: (groupId: string) => void;
  reorderBanGroups: (groupIds: string[]) => void;
  addChampionToBanGroup: (groupId: string, championId: string) => void;
  removeChampionFromBanGroup: (groupId: string, championId: string) => void;
  reorderChampionsInBanGroup: (groupId: string, championIds: string[]) => void;
  moveChampionBetweenBanGroups: (fromGroupId: string, toGroupId: string, championId: string, toIndex?: number) => void;

  // Priority group actions
  addPriorityGroup: (name: string) => void;
  renamePriorityGroup: (groupId: string, name: string) => void;
  deletePriorityGroup: (groupId: string) => void;
  reorderPriorityGroups: (groupIds: string[]) => void;
  addChampionToPriorityGroup: (groupId: string, championId: string) => void;
  removeChampionFromPriorityGroup: (groupId: string, championId: string) => void;
  reorderChampionsInPriorityGroup: (groupId: string, championIds: string[]) => void;
  moveChampionBetweenPriorityGroups: (fromGroupId: string, toGroupId: string, championId: string, toIndex?: number) => void;

  // Legacy actions (for backwards compatibility with other components)
  addPotentialBan: (championId: string) => void;
  removePotentialBan: (championId: string) => void;
  addPriority: (championId: string) => void;
  removePriority: (championId: string) => void;

  // Notepad actions
  addNote: (sessionId: string) => void;
  updateNote: (sessionId: string, noteId: string, content: string) => void;
  deleteNote: (sessionId: string, noteId: string) => void;
}

export const useDraftStore = create<DraftState>()(
  persist(
    cloudSync(
      (set, get) => ({
        sessions: [],
        currentSessionId: null,

        createSession: (name: string, enemyTeamId?: string, myTeamId?: string) => {
          const newSession: DraftSession = {
            id: generateId(),
            name,
            enemyTeamId: enemyTeamId || null,
            myTeamId: myTeamId || null,
            banGroups: [],
            priorityGroups: [],
            notes: '',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          set((state) => ({
            sessions: [...state.sessions, newSession],
            currentSessionId: newSession.id,
          }));
          return newSession;
        },

        updateSession: (id: string, updates: Partial<Omit<DraftSession, 'id' | 'createdAt'>>) => {
          set((state) => ({
            sessions: state.sessions.map((session) =>
              session.id === id
                ? { ...session, ...updates, updatedAt: Date.now() }
                : session
            ),
          }));
        },

        deleteSession: (id: string) => {
          set((state) => ({
            sessions: state.sessions.filter((session) => session.id !== id),
            currentSessionId: state.currentSessionId === id ? null : state.currentSessionId,
          }));
        },

        setCurrentSession: (id: string | null) => {
          set({ currentSessionId: id });
        },

        getCurrentSession: () => {
          const state = get();
          const session = state.sessions.find((s) => s.id === state.currentSessionId);
          return session ? migrateSession(session) : undefined;
        },

        // Ban group actions
        addBanGroup: (name: string) => {
          const { currentSessionId, sessions } = get();
          if (!currentSessionId) return;
          const newGroup: ChampionGroup = {
            id: generateId(),
            name,
            championIds: [],
          };
          set({
            sessions: sessions.map((s) => {
              if (s.id !== currentSessionId) return s;
              const migrated = migrateSession(s);
              return {
                ...migrated,
                banGroups: [...migrated.banGroups, newGroup],
                updatedAt: Date.now(),
              };
            }),
          });
        },

        renameBanGroup: (groupId: string, name: string) => {
          const { currentSessionId, sessions } = get();
          if (!currentSessionId) return;
          set({
            sessions: sessions.map((s) => {
              if (s.id !== currentSessionId) return s;
              const migrated = migrateSession(s);
              return {
                ...migrated,
                banGroups: migrated.banGroups.map((g) =>
                  g.id === groupId ? { ...g, name } : g
                ),
                updatedAt: Date.now(),
              };
            }),
          });
        },

        deleteBanGroup: (groupId: string) => {
          const { currentSessionId, sessions } = get();
          if (!currentSessionId) return;
          set({
            sessions: sessions.map((s) => {
              if (s.id !== currentSessionId) return s;
              const migrated = migrateSession(s);
              return {
                ...migrated,
                banGroups: migrated.banGroups.filter((g) => g.id !== groupId),
                updatedAt: Date.now(),
              };
            }),
          });
        },

        reorderBanGroups: (groupIds: string[]) => {
          const { currentSessionId, sessions } = get();
          if (!currentSessionId) return;
          set({
            sessions: sessions.map((s) => {
              if (s.id !== currentSessionId) return s;
              const migrated = migrateSession(s);
              const groupMap = new Map(migrated.banGroups.map((g) => [g.id, g]));
              return {
                ...migrated,
                banGroups: groupIds.map((id) => groupMap.get(id)!).filter(Boolean),
                updatedAt: Date.now(),
              };
            }),
          });
        },

        addChampionToBanGroup: (groupId: string, championId: string) => {
          const { currentSessionId, sessions } = get();
          if (!currentSessionId) return;
          set({
            sessions: sessions.map((s) => {
              if (s.id !== currentSessionId) return s;
              const migrated = migrateSession(s);
              return {
                ...migrated,
                banGroups: migrated.banGroups.map((g) =>
                  g.id === groupId && !g.championIds.includes(championId)
                    ? { ...g, championIds: [...g.championIds, championId] }
                    : g
                ),
                updatedAt: Date.now(),
              };
            }),
          });
        },

        removeChampionFromBanGroup: (groupId: string, championId: string) => {
          const { currentSessionId, sessions } = get();
          if (!currentSessionId) return;
          set({
            sessions: sessions.map((s) => {
              if (s.id !== currentSessionId) return s;
              const migrated = migrateSession(s);
              return {
                ...migrated,
                banGroups: migrated.banGroups.map((g) =>
                  g.id === groupId
                    ? { ...g, championIds: g.championIds.filter((id) => id !== championId) }
                    : g
                ),
                updatedAt: Date.now(),
              };
            }),
          });
        },

        reorderChampionsInBanGroup: (groupId: string, championIds: string[]) => {
          const { currentSessionId, sessions } = get();
          if (!currentSessionId) return;
          set({
            sessions: sessions.map((s) => {
              if (s.id !== currentSessionId) return s;
              const migrated = migrateSession(s);
              return {
                ...migrated,
                banGroups: migrated.banGroups.map((g) =>
                  g.id === groupId ? { ...g, championIds } : g
                ),
                updatedAt: Date.now(),
              };
            }),
          });
        },

        moveChampionBetweenBanGroups: (fromGroupId: string, toGroupId: string, championId: string, toIndex?: number) => {
          const { currentSessionId, sessions } = get();
          if (!currentSessionId) return;
          set({
            sessions: sessions.map((s) => {
              if (s.id !== currentSessionId) return s;
              const migrated = migrateSession(s);
              return {
                ...migrated,
                banGroups: migrated.banGroups.map((g) => {
                  if (g.id === fromGroupId) {
                    return { ...g, championIds: g.championIds.filter((id) => id !== championId) };
                  }
                  if (g.id === toGroupId) {
                    const newIds = g.championIds.filter((id) => id !== championId);
                    if (toIndex !== undefined) {
                      newIds.splice(toIndex, 0, championId);
                    } else {
                      newIds.push(championId);
                    }
                    return { ...g, championIds: newIds };
                  }
                  return g;
                }),
                updatedAt: Date.now(),
              };
            }),
          });
        },

        // Priority group actions
        addPriorityGroup: (name: string) => {
          const { currentSessionId, sessions } = get();
          if (!currentSessionId) return;
          const newGroup: ChampionGroup = {
            id: generateId(),
            name,
            championIds: [],
          };
          set({
            sessions: sessions.map((s) => {
              if (s.id !== currentSessionId) return s;
              const migrated = migrateSession(s);
              return {
                ...migrated,
                priorityGroups: [...migrated.priorityGroups, newGroup],
                updatedAt: Date.now(),
              };
            }),
          });
        },

        renamePriorityGroup: (groupId: string, name: string) => {
          const { currentSessionId, sessions } = get();
          if (!currentSessionId) return;
          set({
            sessions: sessions.map((s) => {
              if (s.id !== currentSessionId) return s;
              const migrated = migrateSession(s);
              return {
                ...migrated,
                priorityGroups: migrated.priorityGroups.map((g) =>
                  g.id === groupId ? { ...g, name } : g
                ),
                updatedAt: Date.now(),
              };
            }),
          });
        },

        deletePriorityGroup: (groupId: string) => {
          const { currentSessionId, sessions } = get();
          if (!currentSessionId) return;
          set({
            sessions: sessions.map((s) => {
              if (s.id !== currentSessionId) return s;
              const migrated = migrateSession(s);
              return {
                ...migrated,
                priorityGroups: migrated.priorityGroups.filter((g) => g.id !== groupId),
                updatedAt: Date.now(),
              };
            }),
          });
        },

        reorderPriorityGroups: (groupIds: string[]) => {
          const { currentSessionId, sessions } = get();
          if (!currentSessionId) return;
          set({
            sessions: sessions.map((s) => {
              if (s.id !== currentSessionId) return s;
              const migrated = migrateSession(s);
              const groupMap = new Map(migrated.priorityGroups.map((g) => [g.id, g]));
              return {
                ...migrated,
                priorityGroups: groupIds.map((id) => groupMap.get(id)!).filter(Boolean),
                updatedAt: Date.now(),
              };
            }),
          });
        },

        addChampionToPriorityGroup: (groupId: string, championId: string) => {
          const { currentSessionId, sessions } = get();
          if (!currentSessionId) return;
          set({
            sessions: sessions.map((s) => {
              if (s.id !== currentSessionId) return s;
              const migrated = migrateSession(s);
              return {
                ...migrated,
                priorityGroups: migrated.priorityGroups.map((g) =>
                  g.id === groupId && !g.championIds.includes(championId)
                    ? { ...g, championIds: [...g.championIds, championId] }
                    : g
                ),
                updatedAt: Date.now(),
              };
            }),
          });
        },

        removeChampionFromPriorityGroup: (groupId: string, championId: string) => {
          const { currentSessionId, sessions } = get();
          if (!currentSessionId) return;
          set({
            sessions: sessions.map((s) => {
              if (s.id !== currentSessionId) return s;
              const migrated = migrateSession(s);
              return {
                ...migrated,
                priorityGroups: migrated.priorityGroups.map((g) =>
                  g.id === groupId
                    ? { ...g, championIds: g.championIds.filter((id) => id !== championId) }
                    : g
                ),
                updatedAt: Date.now(),
              };
            }),
          });
        },

        reorderChampionsInPriorityGroup: (groupId: string, championIds: string[]) => {
          const { currentSessionId, sessions } = get();
          if (!currentSessionId) return;
          set({
            sessions: sessions.map((s) => {
              if (s.id !== currentSessionId) return s;
              const migrated = migrateSession(s);
              return {
                ...migrated,
                priorityGroups: migrated.priorityGroups.map((g) =>
                  g.id === groupId ? { ...g, championIds } : g
                ),
                updatedAt: Date.now(),
              };
            }),
          });
        },

        moveChampionBetweenPriorityGroups: (fromGroupId: string, toGroupId: string, championId: string, toIndex?: number) => {
          const { currentSessionId, sessions } = get();
          if (!currentSessionId) return;
          set({
            sessions: sessions.map((s) => {
              if (s.id !== currentSessionId) return s;
              const migrated = migrateSession(s);
              return {
                ...migrated,
                priorityGroups: migrated.priorityGroups.map((g) => {
                  if (g.id === fromGroupId) {
                    return { ...g, championIds: g.championIds.filter((id) => id !== championId) };
                  }
                  if (g.id === toGroupId) {
                    const newIds = g.championIds.filter((id) => id !== championId);
                    if (toIndex !== undefined) {
                      newIds.splice(toIndex, 0, championId);
                    } else {
                      newIds.push(championId);
                    }
                    return { ...g, championIds: newIds };
                  }
                  return g;
                }),
                updatedAt: Date.now(),
              };
            }),
          });
        },

        // Legacy actions - add to first group or create default group
        addPotentialBan: (championId: string) => {
          const { currentSessionId, sessions } = get();
          if (!currentSessionId) return;
          set({
            sessions: sessions.map((s) => {
              if (s.id !== currentSessionId) return s;
              const migrated = migrateSession(s);
              // If no groups exist, create a default one
              if (migrated.banGroups.length === 0) {
                return {
                  ...migrated,
                  banGroups: [{
                    id: generateId(),
                    name: 'Bans',
                    championIds: [championId],
                  }],
                  updatedAt: Date.now(),
                };
              }
              // Add to first group
              const alreadyExists = migrated.banGroups.some((g) => g.championIds.includes(championId));
              if (alreadyExists) return migrated;
              return {
                ...migrated,
                banGroups: migrated.banGroups.map((g, i) =>
                  i === 0 ? { ...g, championIds: [...g.championIds, championId] } : g
                ),
                updatedAt: Date.now(),
              };
            }),
          });
        },

        removePotentialBan: (championId: string) => {
          const { currentSessionId, sessions } = get();
          if (!currentSessionId) return;
          set({
            sessions: sessions.map((s) => {
              if (s.id !== currentSessionId) return s;
              const migrated = migrateSession(s);
              return {
                ...migrated,
                banGroups: migrated.banGroups.map((g) => ({
                  ...g,
                  championIds: g.championIds.filter((id) => id !== championId),
                })),
                updatedAt: Date.now(),
              };
            }),
          });
        },

        addPriority: (championId: string) => {
          const { currentSessionId, sessions } = get();
          if (!currentSessionId) return;
          set({
            sessions: sessions.map((s) => {
              if (s.id !== currentSessionId) return s;
              const migrated = migrateSession(s);
              // If no groups exist, create a default one
              if (migrated.priorityGroups.length === 0) {
                return {
                  ...migrated,
                  priorityGroups: [{
                    id: generateId(),
                    name: 'Priorities',
                    championIds: [championId],
                  }],
                  updatedAt: Date.now(),
                };
              }
              // Add to first group
              const alreadyExists = migrated.priorityGroups.some((g) => g.championIds.includes(championId));
              if (alreadyExists) return migrated;
              return {
                ...migrated,
                priorityGroups: migrated.priorityGroups.map((g, i) =>
                  i === 0 ? { ...g, championIds: [...g.championIds, championId] } : g
                ),
                updatedAt: Date.now(),
              };
            }),
          });
        },

        removePriority: (championId: string) => {
          const { currentSessionId, sessions } = get();
          if (!currentSessionId) return;
          set({
            sessions: sessions.map((s) => {
              if (s.id !== currentSessionId) return s;
              const migrated = migrateSession(s);
              return {
                ...migrated,
                priorityGroups: migrated.priorityGroups.map((g) => ({
                  ...g,
                  championIds: g.championIds.filter((id) => id !== championId),
                })),
                updatedAt: Date.now(),
              };
            }),
          });
        },

        // Notepad actions
        addNote: (sessionId: string) => {
          const newNote: Note = {
            id: generateId(),
            content: '',
            createdAt: Date.now(),
          };
          set((state) => ({
            sessions: state.sessions.map((s) =>
              s.id === sessionId
                ? { ...s, notepad: [...(s.notepad || []), newNote], updatedAt: Date.now() }
                : s
            ),
          }));
        },

        updateNote: (sessionId: string, noteId: string, content: string) => {
          set((state) => ({
            sessions: state.sessions.map((s) =>
              s.id === sessionId
                ? {
                    ...s,
                    notepad: (s.notepad || []).map((n) =>
                      n.id === noteId ? { ...n, content } : n
                    ),
                    updatedAt: Date.now(),
                  }
                : s
            ),
          }));
        },

        deleteNote: (sessionId: string, noteId: string) => {
          set((state) => ({
            sessions: state.sessions.map((s) =>
              s.id === sessionId
                ? {
                    ...s,
                    notepad: (s.notepad || []).filter((n) => n.id !== noteId),
                    updatedAt: Date.now(),
                  }
                : s
            ),
          }));
        },
      }),
      {
        storeKey: 'draft-sessions',
        tableName: 'draft_sessions',
        isArraySync: true,
        selectSyncData: (state) => state.sessions,
        transformItem: (session: DraftSession, userId: string, index: number) => {
          const migrated = migrateSession(session);
          return {
            id: session.id,
            user_id: userId,
            name: session.name,
            // Only include FK references if they're valid UUIDs
            enemy_team_id: isValidUUID(session.enemyTeamId) ? session.enemyTeamId : null,
            my_team_id: isValidUUID(session.myTeamId) ? session.myTeamId : null,
            // Store groups as JSON
            ban_groups: migrated.banGroups,
            priority_groups: migrated.priorityGroups,
            notes: session.notes,
            notepad: session.notepad || [],
            sort_order: index,
          };
        },
      }
    ),
    {
      name: 'teamcomp-lol-drafts',
    }
  )
);
