import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DraftSession, ChampionPriority, Role, Priority, generateId } from '../types';

interface DraftState {
  sessions: DraftSession[];
  currentSessionId: string | null;

  // Session management
  createSession: (name: string, enemyTeamId?: string) => DraftSession;
  updateSession: (id: string, updates: Partial<Omit<DraftSession, 'id' | 'createdAt'>>) => void;
  deleteSession: (id: string) => void;
  setCurrentSession: (id: string | null) => void;
  getCurrentSession: () => DraftSession | undefined;

  // Quick actions for current session
  addContestedPick: (championId: string) => void;
  removeContestedPick: (championId: string) => void;
  addPotentialBan: (championId: string) => void;
  removePotentialBan: (championId: string) => void;
  addPriority: (championId: string, role: Role, priority: Priority, notes?: string) => void;
  removePriority: (championId: string) => void;
}

export const useDraftStore = create<DraftState>()(
  persist(
    (set, get) => ({
      sessions: [],
      currentSessionId: null,

      createSession: (name: string, enemyTeamId?: string) => {
        const newSession: DraftSession = {
          id: generateId(),
          name,
          enemyTeamId: enemyTeamId || null,
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

      addPriority: (championId: string, role: Role, priority: Priority, notes: string = '') => {
        const { currentSessionId, sessions } = get();
        if (!currentSessionId) return;
        set({
          sessions: sessions.map((s) => {
            if (s.id !== currentSessionId) return s;
            const exists = s.ourPriorities.find((p) => p.championId === championId);
            if (exists) {
              return {
                ...s,
                ourPriorities: s.ourPriorities.map((p) =>
                  p.championId === championId ? { ...p, role, priority, notes } : p
                ),
                updatedAt: Date.now(),
              };
            }
            return {
              ...s,
              ourPriorities: [...s.ourPriorities, { championId, role, priority, notes }],
              updatedAt: Date.now(),
            };
          }),
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
                  ourPriorities: s.ourPriorities.filter((p) => p.championId !== championId),
                  updatedAt: Date.now(),
                }
              : s
          ),
        });
      },
    }),
    {
      name: 'teamcomp-lol-drafts',
    }
  )
);
