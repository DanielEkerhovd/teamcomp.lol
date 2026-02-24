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
export const getCachedSession = (): Session | null => {
  const storageKey = getSupabaseStorageKey();
  if (!storageKey) return null;

  try {
    const cached = localStorage.getItem(storageKey);
    if (!cached) return null;

    const parsed = JSON.parse(cached);
    // Supabase stores session data in various formats depending on version
    if (parsed?.access_token && parsed?.user) {
      return parsed as Session;
    }
    return null;
  } catch (e) {
    console.warn('Failed to read cached session:', e);
    return null;
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
      },
    })
  : null;

export const isSupabaseConfigured = () => !!supabase;
