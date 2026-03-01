import { create } from 'zustand';
import { supabase } from '../lib/supabase';

interface AdminSessionState {
  // State
  isVerified: boolean;
  hasPin: boolean | null; // null = not yet checked
  expiresAt: Date | null;
  isLocked: boolean;
  lockedUntil: Date | null;
  attemptsRemaining: number | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  checkHasPin: () => Promise<void>;
  setupPin: (newPin: string) => Promise<{ error: string | null }>;
  verifyPin: (pin: string) => Promise<{ error: string | null }>;
  changePin: (oldPin: string, newPin: string) => Promise<{ error: string | null }>;
  extendSession: () => Promise<void>;
  lockSession: () => void;
  reset: () => void;
}

let expiryTimer: ReturnType<typeof setInterval> | null = null;
let extendTimer: ReturnType<typeof setInterval> | null = null;

function clearTimers() {
  if (expiryTimer) {
    clearInterval(expiryTimer);
    expiryTimer = null;
  }
  if (extendTimer) {
    clearInterval(extendTimer);
    extendTimer = null;
  }
}

function startTimers(expiresAt: Date) {
  clearTimers();

  // Check expiry every 30 seconds
  expiryTimer = setInterval(() => {
    const state = useAdminSessionStore.getState();
    if (state.expiresAt && state.expiresAt.getTime() < Date.now()) {
      state.lockSession();
    }
  }, 30_000);

  // Extend session every 10 minutes on activity
  extendTimer = setInterval(() => {
    const state = useAdminSessionStore.getState();
    if (state.isVerified) {
      state.extendSession();
    }
  }, 10 * 60_000);
}

const initialState = {
  isVerified: false,
  hasPin: null,
  expiresAt: null,
  isLocked: false,
  lockedUntil: null,
  attemptsRemaining: null,
  isLoading: false,
  error: null,
};

export const useAdminSessionStore = create<AdminSessionState>((set, get) => ({
  ...initialState,

  checkHasPin: async () => {
    set({ isLoading: true, error: null });
    const { data, error } = await supabase.rpc('has_admin_pin');
    if (error) {
      set({ isLoading: false, error: error.message });
      return;
    }
    const result = data as { success: boolean; has_pin?: boolean; message?: string };
    if (!result.success) {
      set({ isLoading: false, error: result.message || 'Failed to check PIN status' });
      return;
    }
    set({ hasPin: result.has_pin ?? false, isLoading: false });
  },

  setupPin: async (newPin: string) => {
    set({ isLoading: true, error: null });
    const { data, error } = await supabase.rpc('set_admin_pin', { new_pin: newPin });
    if (error) {
      set({ isLoading: false, error: error.message });
      return { error: error.message };
    }
    const result = data as { success: boolean; message?: string };
    if (!result.success) {
      set({ isLoading: false, error: result.message || 'Failed to set PIN' });
      return { error: result.message || 'Failed to set PIN' };
    }
    set({ hasPin: true, isLoading: false });

    // Auto-verify after setup
    return get().verifyPin(newPin);
  },

  verifyPin: async (pin: string) => {
    set({ isLoading: true, error: null });
    const { data, error } = await supabase.rpc('verify_admin_pin', { pin });
    if (error) {
      set({ isLoading: false, error: error.message });
      return { error: error.message };
    }
    const result = data as {
      success: boolean;
      message?: string;
      expires_at?: string;
      attempts_remaining?: number;
      locked?: boolean;
      locked_until?: string;
      remaining_seconds?: number;
    };

    if (!result.success) {
      const newState: Partial<AdminSessionState> = {
        isLoading: false,
        error: result.message || 'Incorrect PIN',
      };
      if (result.attempts_remaining !== undefined) {
        newState.attemptsRemaining = result.attempts_remaining;
      }
      if (result.locked || result.locked_until) {
        newState.isLocked = true;
        newState.lockedUntil = result.locked_until ? new Date(result.locked_until) : null;
      }
      set(newState);
      return { error: result.message || 'Incorrect PIN' };
    }

    const expiresAt = result.expires_at ? new Date(result.expires_at) : new Date(Date.now() + 15 * 60_000);
    set({
      isVerified: true,
      expiresAt,
      isLocked: false,
      lockedUntil: null,
      attemptsRemaining: null,
      isLoading: false,
      error: null,
    });
    startTimers(expiresAt);
    return { error: null };
  },

  changePin: async (oldPin: string, newPin: string) => {
    set({ isLoading: true, error: null });
    const { data, error } = await supabase.rpc('set_admin_pin', {
      new_pin: newPin,
      old_pin: oldPin,
    });
    if (error) {
      set({ isLoading: false, error: error.message });
      return { error: error.message };
    }
    const result = data as { success: boolean; message?: string };
    if (!result.success) {
      set({ isLoading: false, error: result.message || 'Failed to change PIN' });
      return { error: result.message || 'Failed to change PIN' };
    }
    // After changing PIN, session is invalidated — need to re-verify
    set({ isVerified: false, expiresAt: null, isLoading: false, error: null });
    clearTimers();
    return { error: null };
  },

  extendSession: async () => {
    const { data, error } = await supabase.rpc('extend_admin_session');
    if (error || !(data as { success: boolean }).success) {
      // Session expired server-side
      get().lockSession();
      return;
    }
    const result = data as { success: boolean; expires_at?: string };
    if (result.expires_at) {
      set({ expiresAt: new Date(result.expires_at) });
    }
  },

  lockSession: () => {
    clearTimers();
    set({
      isVerified: false,
      expiresAt: null,
      error: null,
      attemptsRemaining: null,
    });
  },

  reset: () => {
    clearTimers();
    set(initialState);
  },
}));
