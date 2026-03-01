import { create } from 'zustand';
import type { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured, clearCachedSession } from '../lib/supabase';
import { checkModerationAndRecord, getViolationWarning } from '../lib/moderation';
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
  maxEnemyTeams: number;
  maxDrafts: number;
  role: ProfileRole | null;
  roleTeamId: string | null;
  roleTeamName: string | null;
  isPrivate: boolean;
  stripeCustomerId: string | null;
  avatarModeratedUntil: string | null;
  bannedAt: string | null;
  banReason: string | null;
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
  signUpWithEmail: (email: string, password: string) => Promise<{ error: AuthError | null; confirmationRequired?: boolean }>;
  signInWithGoogle: () => Promise<{ error: AuthError | null }>;
  signInWithDiscord: () => Promise<{ error: AuthError | null }>;
  signInWithTwitch: () => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  setSession: (session: Session | null) => Promise<void>;
  clearError: () => void;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: AuthError | null }>;
  updateDisplayName: (displayName: string) => Promise<{ error: string | null }>;
  updateAvatar: (file: File) => Promise<{ error: string | null }>;
  removeAvatar: () => Promise<{ error: string | null }>;
  generateRandomAvatar: () => Promise<{ error: string | null }>;
  updateRole: (role: ProfileRole | null, teamId: string | null) => Promise<{ error: string | null }>;
  updateEmail: (newEmail: string) => Promise<{ error: string | null }>;
  updatePrivacy: (isPrivate: boolean) => Promise<{ error: string | null }>;
  deleteAccount: () => Promise<{ error: string | null }>;
}

const transformProfile = (dbProfile: Profile, roleTeamName?: string | null): UserProfile => ({
  id: dbProfile.id,
  email: dbProfile.email,
  displayName: dbProfile.display_name,
  avatarUrl: dbProfile.avatar_url,
  tier: dbProfile.tier,
  maxTeams: dbProfile.max_teams,
  maxEnemyTeams: dbProfile.max_enemy_teams,
  maxDrafts: dbProfile.max_drafts,
  role: dbProfile.role,
  roleTeamId: dbProfile.role_team_id,
  roleTeamName: roleTeamName ?? null,
  isPrivate: dbProfile.is_private,
  stripeCustomerId: dbProfile.stripe_customer_id ?? null,
  avatarModeratedUntil: dbProfile.avatar_moderated_until ?? null,
  bannedAt: dbProfile.banned_at ?? null,
  banReason: dbProfile.ban_reason ?? null,
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
          // Transform auth error messages to be more user-friendly
          let friendlyMessage = error.message;
          if (error.message?.includes('Invalid login credentials')) {
            friendlyMessage = 'Incorrect email or password';
          } else if (error.message?.includes('Email not confirmed')) {
            friendlyMessage = 'Please check your email to confirm your account';
          }
          set({ isLoading: false, error: friendlyMessage });
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

        // Save current page so email confirmation can redirect back
        try { localStorage.setItem('teamcomp-lol-auth-return-url', window.location.pathname + window.location.search); } catch { /* ignore */ }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });

        if (error) {
          // Transform auth error messages to be more user-friendly
          let friendlyMessage = error.message;
          if (error.message?.includes('already registered') || error.message?.includes('already exists')) {
            friendlyMessage = 'An account with this email already exists';
          } else if (error.message?.includes('password')) {
            friendlyMessage = 'Password must be at least 6 characters';
          }
          set({ isLoading: false, error: friendlyMessage });
          return { error };
        }

        // Check for duplicate email - Supabase returns user with empty identities array
        if (data.user && (!data.user.identities || data.user.identities.length === 0)) {
          const duplicateError = { message: 'An account with this email already exists' } as AuthError;
          set({ isLoading: false, error: duplicateError.message });
          return { error: duplicateError };
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
        } else if (data.user && !data.session) {
          // Email confirmation required - return flag instead of error
          set({ isLoading: false });
          return { error: null, confirmationRequired: true };
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

        // Save current page so we can redirect back after OAuth
        try { localStorage.setItem('teamcomp-lol-auth-return-url', window.location.pathname + window.location.search); } catch { /* ignore */ }

        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: `${window.location.origin}/auth/callback`,
            queryParams: {
              prompt: 'select_account',
            },
          },
        });

        if (error) {
          set({ isLoading: false, error: 'Could not sign in with Google. Please try again.' });
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

        // Save current page so we can redirect back after OAuth
        try { localStorage.setItem('teamcomp-lol-auth-return-url', window.location.pathname + window.location.search); } catch { /* ignore */ }

        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'discord',
          options: {
            redirectTo: `${window.location.origin}/auth/callback`,
          },
        });

        if (error) {
          set({ isLoading: false, error: 'Could not sign in with Discord. Please try again.' });
          return { error };
        }

        // OAuth redirects, so we don't need to handle the response here
        return { error: null };
      },

      signInWithTwitch: async () => {
        if (!supabase) {
          return { error: { message: 'Supabase not configured' } as AuthError };
        }

        set({ isLoading: true, error: null });

        // Save current page so we can redirect back after OAuth
        try { localStorage.setItem('teamcomp-lol-auth-return-url', window.location.pathname + window.location.search); } catch { /* ignore */ }

        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'twitch',
          options: {
            redirectTo: `${window.location.origin}/auth/callback`,
          },
        });

        if (error) {
          set({ isLoading: false, error: 'Could not sign in with Twitch. Please try again.' });
          return { error };
        }

        // OAuth redirects, so we don't need to handle the response here
        return { error: null };
      },

      signOut: async () => {
        set({ isLoading: true });

        if (supabase) {
          try {
            await Promise.race([
              supabase.auth.signOut(),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Sign out timeout')), 5000)),
            ]);
          } catch (error) {
            // Continue with sign out even if the API call fails or times out
            console.error('Sign out error:', error);
          }
        }

        // Always clear cached session as fallback (handles edge cases where supabase call fails)
        clearCachedSession();

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

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: profileData } = await (supabase as any)
          .from('profiles')
          .select('*, role_team:my_teams!profiles_role_team_id_fkey(name)')
          .eq('id', user.id)
          .single();

        if (profileData) {
          const roleTeamName = profileData.role_team?.name ?? null;
          set({ profile: transformProfile(profileData, roleTeamName) });
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

      resetPassword: async (email: string) => {
        if (!supabase) {
          return { error: { message: 'Supabase not configured' } as AuthError };
        }

        set({ isLoading: true, error: null });

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });

        set({ isLoading: false, error: error?.message || null });

        return { error };
      },

      updatePassword: async (newPassword: string) => {
        if (!supabase) {
          return { error: { message: 'Supabase not configured' } as AuthError };
        }

        set({ isLoading: true, error: null });

        const { error } = await supabase.auth.updateUser({ password: newPassword });

        set({ isLoading: false, error: error?.message || null });

        return { error };
      },

      updateDisplayName: async (displayName: string) => {
        const { user } = get();
        if (!user || !supabase) {
          return { error: 'Please sign in to continue' };
        }

        const trimmedName = displayName.trim();
        if (!trimmedName) {
          return { error: 'Please enter a display name' };
        }
        if (trimmedName.length > 30) {
          return { error: 'Display name must be 30 characters or less' };
        }

        // Moderate display name content
        const modResult = await checkModerationAndRecord(trimmedName, 'display_name');
        if (modResult.flagged) {
          return { error: getViolationWarning(modResult) };
        }

        const client = supabase;

        // Check if display name is taken by another user (case-insensitive)
        const { data: existing } = await client
          .from('profiles')
          .select('id')
          .ilike('display_name', trimmedName)
          .neq('id', user.id)
          .maybeSingle();

        if (existing) {
          return { error: 'This username is already taken' };
        }

        // Update the display name
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (client as any)
          .from('profiles')
          .update({ display_name: trimmedName })
          .eq('id', user.id);

        if (error) {
          // Handle unique constraint violation for display name
          if (error.message?.includes('idx_profiles_display_name_unique') ||
              error.code === '23505') {
            return { error: 'This username is already taken' };
          }
          return { error: 'Failed to update username. Please try again.' };
        }

        // Refresh the profile to get updated data
        await get().refreshProfile();

        return { error: null };
      },

      updateAvatar: async (file: File) => {
        const { user, profile } = get();
        if (!user || !supabase) {
          return { error: 'Please sign in to continue' };
        }

        // Tier gate: only paid tiers can upload custom avatars
        if (profile?.tier === 'free') {
          return { error: 'Custom avatar uploads require a paid plan. Use the random avatar generator instead.' };
        }

        // Moderation cooldown check
        if (profile?.avatarModeratedUntil && new Date(profile.avatarModeratedUntil) > new Date()) {
          const until = new Date(profile.avatarModeratedUntil).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
          return { error: `Your avatar was removed by a moderator. You can upload a new avatar after ${until}.` };
        }

        // Validate file type
        if (!file.type.startsWith('image/')) {
          return { error: 'Please select an image file' };
        }

        // Validate file size (max 2MB)
        if (file.size > 2 * 1024 * 1024) {
          return { error: 'Image size must be under 2MB' };
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
          return { error: 'Please sign in to continue' };
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

      generateRandomAvatar: async () => {
        const { user, profile } = get();
        if (!user || !supabase) {
          return { error: 'Please sign in to continue' };
        }

        // Moderation cooldown check
        if (profile?.avatarModeratedUntil && new Date(profile.avatarModeratedUntil) > new Date()) {
          const until = new Date(profile.avatarModeratedUntil).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
          return { error: `Your avatar was removed by a moderator. You can upload a new avatar after ${until}.` };
        }

        const seed = crypto.randomUUID();
        const avatarUrl = `https://api.dicebear.com/9.x/pixel-art/svg?seed=${seed}`;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: updateError } = await (supabase as any)
          .from('profiles')
          .update({ avatar_url: avatarUrl })
          .eq('id', user.id);

        if (updateError) {
          return { error: updateError.message };
        }

        await get().refreshProfile();
        return { error: null };
      },

      updateRole: async (role: ProfileRole | null, teamId: string | null) => {
        const { user, profile } = get();
        if (!user || !supabase) {
          return { error: 'Please sign in to continue' };
        }

        // Check if user can select developer role (requires developer tier)
        if (role === 'developer' && profile?.tier !== 'developer') {
          return { error: 'The Developer role is only available for developer accounts' };
        }

        const client = supabase;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (client as any)
          .from('profiles')
          .update({
            role: role,
            role_team_id: teamId,
          })
          .eq('id', user.id);

        if (error) {
          return { error: 'Failed to update role. Please try again.' };
        }

        // Refresh the profile to get updated data
        await get().refreshProfile();

        return { error: null };
      },

      updatePrivacy: async (isPrivate: boolean) => {
        const { user } = get();
        if (!user || !supabase) {
          return { error: 'Please sign in to continue' };
        }

        const client = supabase;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (client as any)
          .from('profiles')
          .update({ is_private: isPrivate })
          .eq('id', user.id);

        if (error) {
          return { error: 'Failed to update privacy settings. Please try again.' };
        }

        // Refresh the profile to get updated data
        await get().refreshProfile();

        return { error: null };
      },

      updateEmail: async (newEmail: string) => {
        const { user } = get();
        if (!user || !supabase) {
          return { error: 'Please sign in to continue' };
        }

        const trimmed = newEmail.trim().toLowerCase();
        if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
          return { error: 'Please enter a valid email address' };
        }

        if (trimmed === user.email) {
          return { error: 'This is already your current email' };
        }

        const { error } = await supabase.auth.updateUser({ email: trimmed });

        if (error) {
          if (error.message?.includes('already registered') || error.message?.includes('already exists')) {
            return { error: 'An account with this email already exists' };
          }
          return { error: error.message || 'Failed to update email. Please try again.' };
        }

        return { error: null };
      },

      deleteAccount: async () => {
        const { user } = get();
        if (!user || !supabase) {
          return { error: 'Please sign in to continue' };
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
    return { maxTeams: 1, tier: 'guest' as const };
  }

  return {
    maxTeams: profile?.maxTeams ?? 1,
    tier: profile?.tier ?? 'free',
  };
};

// Default tier limits (used for guests and as fallbacks)
export const FREE_TIER_MAX_TEAMS = 1;
export const FREE_TIER_MAX_ENEMY_TEAMS = 10;
export const FREE_TIER_MAX_DRAFTS = 20;

// Helper hook for checking tier limits (drafts, teams, etc.)
export const useTierLimits = () => {
  const { user, profile } = useAuthStore();

  // Compute isAuthenticated directly from user (getter doesn't work with destructuring)
  const isAuthenticated = !!user;
  const tier = !isAuthenticated ? 'guest' : (profile?.tier ?? 'free');
  const isFreeTier = tier === 'free' || tier === 'guest';
  const isPaidTier = tier === 'beta' || tier === 'paid' || tier === 'supporter' || tier === 'admin' || tier === 'developer';

  return {
    tier,
    isFreeTier,
    isPaidTier,
    isAuthenticated,
    maxTeams: !isAuthenticated ? FREE_TIER_MAX_TEAMS : (profile?.maxTeams ?? FREE_TIER_MAX_TEAMS),
    maxEnemyTeams: !isAuthenticated ? FREE_TIER_MAX_ENEMY_TEAMS : (profile?.maxEnemyTeams ?? FREE_TIER_MAX_ENEMY_TEAMS),
    maxDrafts: !isAuthenticated ? FREE_TIER_MAX_DRAFTS : (profile?.maxDrafts ?? FREE_TIER_MAX_DRAFTS),
  };
};
