import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DraftSession, generateId, Note } from '../types';
import { cloudSync } from './middleware/cloudSync';

// Helper to validate UUID format for database FK references
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isValidUUID = (id: string | null | undefined): boolean => {
  if (!id) return false;
  return UUID_REGEX.test(id);
};

interface DraftState {
  sessions: DraftSession[];
  currentSessionId: string | null;

  // Session management
  createSession: (name: string, enemyTeamId?: string, myTeamId?: string) => DraftSession;
  updateSession: (id: string, updates: Partial<Omit<DraftSession, 'id' | 'createdAt'>>) => void;
  deleteSession: (id: string) => void;
  setCurrentSession: (id: string | null) => void;
  getCurrentSession: () => DraftSession | undefined;

  // Quick actions for current session
  addContestedPick: (championId: string) => void;
  removeContestedPick: (championId: string) => void;
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
            contestedPicks: [],
            potentialBans: [],
            ourPriorities: [],
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
        return state.sessions.find((s) => s.id === state.currentSessionId);
      },

      // Quick actions for current session
      addContestedPick: (championId: string) => {
        const { currentSessionId, sessions } = get();
        if (!currentSessionId) return;
        set({
          sessions: sessions.map((s) =>
            s.id === currentSessionId
              ? {
                  ...s,
                  contestedPicks: s.contestedPicks.includes(championId)
                    ? s.contestedPicks
                    : [...s.contestedPicks, championId],
                  updatedAt: Date.now(),
                }
              : s
          ),
        });
      },

      removeContestedPick: (championId: string) => {
        const { currentSessionId, sessions } = get();
        if (!currentSessionId) return;
        set({
          sessions: sessions.map((s) =>
            s.id === currentSessionId
              ? {
                  ...s,
                  contestedPicks: s.contestedPicks.filter((id) => id !== championId),
                  updatedAt: Date.now(),
                }
              : s
          ),
        });
      },

      addPotentialBan: (championId: string) => {
        const { currentSessionId, sessions } = get();
        if (!currentSessionId) return;
        set({
          sessions: sessions.map((s) =>
            s.id === currentSessionId
              ? {
                  ...s,
                  potentialBans: s.potentialBans.includes(championId)
                    ? s.potentialBans
                    : [...s.potentialBans, championId],
                  updatedAt: Date.now(),
                }
              : s
          ),
        });
      },

      removePotentialBan: (championId: string) => {
        const { currentSessionId, sessions } = get();
        if (!currentSessionId) return;
        set({
          sessions: sessions.map((s) =>
            s.id === currentSessionId
              ? {
                  ...s,
                  potentialBans: s.potentialBans.filter((id) => id !== championId),
                  updatedAt: Date.now(),
                }
              : s
          ),
        });
      },

      addPriority: (championId: string) => {
        const { currentSessionId, sessions } = get();
        if (!currentSessionId) return;
        set({
          sessions: sessions.map((s) =>
            s.id === currentSessionId
              ? {
                  ...s,
                  ourPriorities: s.ourPriorities.includes(championId)
                    ? s.ourPriorities
                    : [...s.ourPriorities, championId],
                  updatedAt: Date.now(),
                }
              : s
          ),
        });
      },

      removePriority: (championId: string) => {
        const { currentSessionId, sessions } = get();
        if (!currentSessionId) return;
        set({
          sessions: sessions.map((s) =>
            s.id === currentSessionId
              ? {
                  ...s,
                  ourPriorities: s.ourPriorities.filter((id) => id !== championId),
                  updatedAt: Date.now(),
                }
              : s
          ),
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
        transformItem: (session: DraftSession, userId: string, index: number) => ({
          id: session.id,
          user_id: userId,
          name: session.name,
          // Only include FK references if they're valid UUIDs
          enemy_team_id: isValidUUID(session.enemyTeamId) ? session.enemyTeamId : null,
          my_team_id: isValidUUID(session.myTeamId) ? session.myTeamId : null,
          priority_picks: session.contestedPicks, // renamed from contested_picks
          potential_bans: session.potentialBans,
          our_priorities: session.ourPriorities,
          notes: session.notes,
          notepad: session.notepad || [], // array of note objects
          sort_order: index,
        }),
      }
    ),
    {
      name: 'teamcomp-lol-drafts',
    }
  )
);
