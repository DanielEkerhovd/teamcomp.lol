import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Profile, UserTier } from '../types/database';

export interface UserProfile {
  id: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  tier: UserTier;
  maxTeams: number;
}

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;

  // Computed
  isAuthenticated: boolean;
  isGuest: boolean;

  // Actions
  initialize: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUpWithEmail: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signInWithGoogle: () => Promise<{ error: AuthError | null }>;
  signInWithDiscord: () => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  setSession: (session: Session | null) => void;
  clearError: () => void;
}

const transformProfile = (dbProfile: Profile): UserProfile => ({
  id: dbProfile.id,
  email: dbProfile.email,
  displayName: dbProfile.display_name,
  avatarUrl: dbProfile.avatar_url,
  tier: dbProfile.tier,
  maxTeams: dbProfile.max_teams,
});

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      session: null,
      profile: null,
      isLoading: false,
      isInitialized: false,
      error: null,

      get isAuthenticated() {
        return !!get().user;
      },

      get isGuest() {
        return !get().user;
      },

      initialize: async () => {
        if (!isSupabaseConfigured() || !supabase) {
          set({ isInitialized: true, isLoading: false });
          return;
        }

        set({ isLoading: true });

        try {
          const { data: { session } } = await supabase.auth.getSession();

          if (session?.user) {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single();

            set({
              user: session.user,
              session,
              profile: profileData ? transformProfile(profileData) : null,
              isLoading: false,
              isInitialized: true,
              error: null,
            });
          } else {
            set({
              user: null,
              session: null,
              profile: null,
              isLoading: false,
              isInitialized: true,
              error: null,
            });
          }
        } catch (error) {
          console.error('Auth initialization error:', error);
          set({
            isLoading: false,
            isInitialized: true,
            error: 'Failed to initialize authentication',
          });
        }
      },

      signInWithEmail: async (email: string, password: string) => {
        if (!supabase) {
          return { error: { message: 'Supabase not configured' } as AuthError };
        }

        set({ isLoading: true, error: null });

        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          set({ isLoading: false, error: error.message });
          return { error };
        }

        if (data.user) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();

          set({
            user: data.user,
            session: data.session,
            profile: profileData ? transformProfile(profileData) : null,
            isLoading: false,
            error: null,
          });
        }

        return { error: null };
      },

      signUpWithEmail: async (email: string, password: string) => {
        if (!supabase) {
          return { error: { message: 'Supabase not configured' } as AuthError };
        }

        set({ isLoading: true, error: null });

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) {
          set({ isLoading: false, error: error.message });
          return { error };
        }

        // Note: User might need to confirm email depending on Supabase settings
        if (data.user && data.session) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();

          set({
            user: data.user,
            session: data.session,
            profile: profileData ? transformProfile(profileData) : null,
            isLoading: false,
            error: null,
          });
        } else {
          set({ isLoading: false });
        }

        return { error: null };
      },

      signInWithGoogle: async () => {
        if (!supabase) {
          return { error: { message: 'Supabase not configured' } as AuthError };
        }

        set({ isLoading: true, error: null });

        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: window.location.origin,
          },
        });

        if (error) {
          set({ isLoading: false, error: error.message });
          return { error };
        }

        // OAuth redirects, so we don't need to handle the response here
        return { error: null };
      },

      signInWithDiscord: async () => {
        if (!supabase) {
          return { error: { message: 'Supabase not configured' } as AuthError };
        }

        set({ isLoading: true, error: null });

        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'discord',
          options: {
            redirectTo: window.location.origin,
          },
        });

        if (error) {
          set({ isLoading: false, error: error.message });
          return { error };
        }

        // OAuth redirects, so we don't need to handle the response here
        return { error: null };
      },

      signOut: async () => {
        if (!supabase) return;

        set({ isLoading: true });

        await supabase.auth.signOut();

        set({
          user: null,
          session: null,
          profile: null,
          isLoading: false,
          error: null,
        });
      },

      refreshProfile: async () => {
        const { user } = get();
        if (!user || !supabase) return;

        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profileData) {
          set({ profile: transformProfile(profileData) });
        }
      },

      setSession: (session: Session | null) => {
        if (session) {
          set({
            user: session.user,
            session,
          });
          // Fetch profile after setting session
          get().refreshProfile();
        } else {
          set({
            user: null,
            session: null,
            profile: null,
          });
        }
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'teamcomp-lol-auth',
      partialize: (state) => ({
        // Only persist minimal auth state - session is managed by Supabase
        // We just need to know if we should attempt to restore
      }),
    }
  )
);

// Helper hook for checking team limits
export const useTeamLimit = () => {
  const { profile, isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    // Guest mode - use localStorage limit
    return { maxTeams: 3, tier: 'guest' as const };
  }

  return {
    maxTeams: profile?.maxTeams ?? 1,
    tier: profile?.tier ?? 'free',
  };
};
