import { createClient, Session } from '@supabase/supabase-js';
import type { Database } from '../types/database';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Get the storage key Supabase uses for this project
const getSupabaseStorageKey = () => {
  if (!supabaseUrl) return null;
  try {
    const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
    return `sb-${projectRef}-auth-token`;
  } catch {
    return null;
  }
};

// Read cached session directly from localStorage (no network calls)
// Returns null if session is expired or invalid
export const getCachedSession = (): Session | null => {
  const storageKey = getSupabaseStorageKey();
  if (!storageKey) return null;

  try {
    const cached = localStorage.getItem(storageKey);
    if (!cached) return null;

    const parsed = JSON.parse(cached);
    // Supabase stores session data in various formats depending on version
    if (parsed?.access_token && parsed?.user) {
      // Check if the session is expired
      if (parsed.expires_at) {
        const expiresAt = parsed.expires_at * 1000; // Convert to milliseconds
        const now = Date.now();
        // Add 30 second buffer to avoid edge cases
        if (now >= expiresAt - 30000) {
          console.log('Cached session is expired, clearing it');
          clearCachedSession();
          return null;
        }
      }
      return parsed as Session;
    }
    return null;
  } catch (e) {
    console.warn('Failed to read cached session:', e);
    return null;
  }
};

// Clear the cached session from localStorage
export const clearCachedSession = (): void => {
  const storageKey = getSupabaseStorageKey();
  if (storageKey) {
    localStorage.removeItem(storageKey);
  }
};

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase credentials not configured. Running in offline mode. ' +
    'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env to enable cloud features.'
  );
}

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        // Disable Navigator Lock to prevent timeout issues when locks get stuck
        // This is safe for single-tab usage; for multi-tab you may want a custom lock
        lock: async <R,>(_name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> => {
          // Simply execute the function without locking
          // This prevents NavigatorLockAcquireTimeoutError when locks get stuck
          return await fn();
        },
      },
    })
  : null;

export const isSupabaseConfigured = () => !!supabase;
