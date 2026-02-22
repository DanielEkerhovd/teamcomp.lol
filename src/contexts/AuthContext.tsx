import { createContext, useContext, useEffect, ReactNode } from 'react';
import { useAuthStore } from '../stores/useAuthStore';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface AuthContextValue {
  isConfigured: boolean;
}

const AuthContext = createContext<AuthContextValue>({ isConfigured: false });

export function AuthProvider({ children }: { children: ReactNode }) {
  const { initialize, setSession, isInitialized } = useAuthStore();

  useEffect(() => {
    // Initialize auth state
    initialize();

    // Set up auth state listener
    if (isSupabaseConfigured() && supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          console.log('Auth state changed:', event);

          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            setSession(session);
          } else if (event === 'SIGNED_OUT') {
            setSession(null);
          }
        }
      );

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [initialize, setSession]);

  // Show loading state until auth is initialized
  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-lol-gray flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-lol-gold-light to-lol-gold flex items-center justify-center text-lol-dark font-bold text-xl animate-pulse">
            TC
          </div>
          <div className="text-gray-400 text-sm">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ isConfigured: isSupabaseConfigured() }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuthContext = () => useContext(AuthContext);
