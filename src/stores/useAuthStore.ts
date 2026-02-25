import { create } from 'zustand';
import type { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Profile, UserTier, ProfileRole } from '../types/database';

// Guard against multiple initialization calls (React Strict Mode)
let isInitializing = false;

export interface UserProfile {
  id: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  tier: UserTier;
  maxTeams: number;
  role: ProfileRole | null;
  roleTeamId: string | null;
  roleCustom: string | null;
  isPrivate: boolean;
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
  setSession: (session: Session | null) => Promise<void>;
  clearError: () => void;
  updateDisplayName: (displayName: string) => Promise<{ error: string | null }>;
  updateAvatar: (file: File) => Promise<{ error: string | null }>;
  removeAvatar: () => Promise<{ error: string | null }>;
  updateRole: (role: ProfileRole | null, teamId: string | null, customRole: string | null) => Promise<{ error: string | null }>;
  updatePrivacy: (isPrivate: boolean) => Promise<{ error: string | null }>;
  deleteAccount: () => Promise<{ error: string | null }>;
}

const transformProfile = (dbProfile: Profile): UserProfile => ({
  id: dbProfile.id,
  email: dbProfile.email,
  displayName: dbProfile.display_name,
  avatarUrl: dbProfile.avatar_url,
  tier: dbProfile.tier,
  maxTeams: dbProfile.max_teams,
  role: dbProfile.role,
  roleTeamId: dbProfile.role_team_id,
  roleCustom: dbProfile.role_custom,
  isPrivate: dbProfile.is_private,
});

export const useAuthStore = create<AuthState>()((set, get) => ({
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
    // Prevent double initialization (React Strict Mode)
    if (isInitializing || get().isInitialized) {
      return;
    }
    isInitializing = true;

    if (!isSupabaseConfigured() || !supabase) {
      set({ isInitialized: true, isLoading: false });
      isInitializing = false;
      return;
    }

    // Don't call getSession() here - it can hang indefinitely
    // Instead, we rely on onAuthStateChange INITIAL_SESSION event in AuthContext
    // Just mark as initialized so the app can render
    set({ isLoading: true });
    isInitializing = false;
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
            queryParams: {
              prompt: 'select_account',
            },
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

        try {
          await supabase.auth.signOut();
        } catch (error) {
          // Continue with sign out even if the API call fails
          console.error('Sign out error:', error);
        }

        // Clear all local data stores
        const storeKeys = [
          'teamcomp-lol-my-team',
          'teamcomp-lol-enemy-teams',
          'teamcomp-lol-drafts',
          'teamcomp-lol-player-pools',
          'teamcomp-lol-custom-pools',
          'teamcomp-lol-draft-theory',
          'teamcomp-lol-custom-templates',
        ];
        storeKeys.forEach((key) => localStorage.removeItem(key));

        set({
          user: null,
          session: null,
          profile: null,
          isLoading: false,
          error: null,
        });

        // Reload to reset all Zustand stores to initial state
        window.location.reload();
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

      setSession: async (session: Session | null) => {
        if (session) {
          set({
            user: session.user,
            session,
          });
          // Fetch profile after setting session and wait for it
          await get().refreshProfile();
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

      updateDisplayName: async (displayName: string) => {
        const { user } = get();
        if (!user || !supabase) {
          return { error: 'Not authenticated' };
        }

        const trimmedName = displayName.trim();
        if (!trimmedName) {
          return { error: 'Display name cannot be empty' };
        }

        const client = supabase;

        // Check if display name is taken by another user (case-insensitive)
        const { data: existing } = await client
          .from('profiles')
          .select('id')
          .ilike('display_name', trimmedName)
          .neq('id', user.id)
          .single();

        if (existing) {
          return { error: 'Username is already taken' };
        }

        // Update the display name
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (client as any)
          .from('profiles')
          .update({ display_name: trimmedName })
          .eq('id', user.id);

        if (error) {
          return { error: error.message };
        }

        // Refresh the profile to get updated data
        await get().refreshProfile();

        return { error: null };
      },

      updateAvatar: async (file: File) => {
        const { user } = get();
        if (!user || !supabase) {
          return { error: 'Not authenticated' };
        }

        // Validate file type
        if (!file.type.startsWith('image/')) {
          return { error: 'File must be an image' };
        }

        // Validate file size (max 2MB)
        if (file.size > 2 * 1024 * 1024) {
          return { error: 'Image must be less than 2MB' };
        }

        const client = supabase;
        const fileExt = file.name.split('.').pop();
        const filePath = `${user.id}/avatar.${fileExt}`;

        // Upload to Supabase Storage
        const { error: uploadError } = await client.storage
          .from('avatars')
          .upload(filePath, file, { upsert: true });

        if (uploadError) {
          return { error: uploadError.message };
        }

        // Get public URL
        const { data: { publicUrl } } = client.storage
          .from('avatars')
          .getPublicUrl(filePath);

        // Update profile with new avatar URL (add cache buster)
        const avatarUrl = `${publicUrl}?t=${Date.now()}`;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: updateError } = await (client as any)
          .from('profiles')
          .update({ avatar_url: avatarUrl })
          .eq('id', user.id);

        if (updateError) {
          return { error: updateError.message };
        }

        // Refresh the profile to get updated data
        await get().refreshProfile();

        return { error: null };
      },

      removeAvatar: async () => {
        const { user } = get();
        if (!user || !supabase) {
          return { error: 'Not authenticated' };
        }

        const client = supabase;

        // List and delete all avatar files for this user
        const { data: files } = await client.storage
          .from('avatars')
          .list(user.id);

        if (files && files.length > 0) {
          const filePaths = files.map(f => `${user.id}/${f.name}`);
          await client.storage.from('avatars').remove(filePaths);
        }

        // Update profile to remove avatar URL
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: updateError } = await (client as any)
          .from('profiles')
          .update({ avatar_url: null })
          .eq('id', user.id);

        if (updateError) {
          return { error: updateError.message };
        }

        // Refresh the profile to get updated data
        await get().refreshProfile();

        return { error: null };
      },

      updateRole: async (role: ProfileRole | null, teamId: string | null, customRole: string | null) => {
        const { user } = get();
        if (!user || !supabase) {
          return { error: 'Not authenticated' };
        }

        const client = supabase;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (client as any)
          .from('profiles')
          .update({
            role: role,
            role_team_id: teamId,
            role_custom: role === 'custom' ? customRole : null,
          })
          .eq('id', user.id);

        if (error) {
          return { error: error.message };
        }

        // Refresh the profile to get updated data
        await get().refreshProfile();

        return { error: null };
      },

      updatePrivacy: async (isPrivate: boolean) => {
        const { user } = get();
        if (!user || !supabase) {
          return { error: 'Not authenticated' };
        }

        const client = supabase;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (client as any)
          .from('profiles')
          .update({ is_private: isPrivate })
          .eq('id', user.id);

        if (error) {
          return { error: error.message };
        }

        // Refresh the profile to get updated data
        await get().refreshProfile();

        return { error: null };
      },

      deleteAccount: async () => {
        const { user } = get();
        if (!user || !supabase) {
          return { error: 'Not authenticated' };
        }

        const client = supabase;

        // Call the delete-account Edge Function using Supabase client
        const { data, error: invokeError } = await client.functions.invoke('delete-account', {
          method: 'POST',
        });

        if (invokeError) {
          return { error: invokeError.message || 'Failed to delete account' };
        }

        if (data?.error) {
          return { error: data.error };
        }

        // Sign out after successful deletion
        await client.auth.signOut();

        set({
          user: null,
          session: null,
          profile: null,
          isLoading: false,
          error: null,
        });

        return { error: null };
      },
    }));

// Helper hook for checking team limits
export const useTeamLimit = () => {
  const { user, profile } = useAuthStore();

  // Compute isAuthenticated directly from user (getter doesn't work with destructuring)
  if (!user) {
    // Guest mode - use localStorage limit
    return { maxTeams: 3, tier: 'guest' as const };
  }

  return {
    maxTeams: profile?.maxTeams ?? 1,
    tier: profile?.tier ?? 'free',
  };
};

// Constants for tier limits
export const FREE_TIER_MAX_DRAFTS = 20;

// Helper hook for checking tier limits (drafts, teams, etc.)
export const useTierLimits = () => {
  const { user, profile } = useAuthStore();

  // Compute isAuthenticated directly from user (getter doesn't work with destructuring)
  const isAuthenticated = !!user;
  const tier = !isAuthenticated ? 'guest' : (profile?.tier ?? 'free');
  const isFreeTier = tier === 'free' || tier === 'guest';
  const isPaidTier = tier === 'paid' || tier === 'supporter' || tier === 'admin';

  return {
    tier,
    isFreeTier,
    isPaidTier,
    isAuthenticated,
    maxTeams: !isAuthenticated ? 3 : (profile?.maxTeams ?? 1),
    maxDrafts: isPaidTier ? Infinity : FREE_TIER_MAX_DRAFTS,
  };
};
