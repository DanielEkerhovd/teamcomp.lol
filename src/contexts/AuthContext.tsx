import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session } from '@supabase/supabase-js';
import { useAuthStore } from '../stores/useAuthStore';
import { supabase, isSupabaseConfigured, getCachedSession, clearCachedSession } from '../lib/supabase';
import { syncManager } from '../lib/syncManager';
import LocalDataMergeModal, { getLocalDataSummary, clearAllLocalStores, ExcludedItems, AlreadyInCloud, getLocalDataWithIds, compareLocalWithCloud } from '../components/onboarding/LocalDataMergeModal';
import { useMyTeamStore } from '../stores/useMyTeamStore';
import { useEnemyTeamStore } from '../stores/useEnemyTeamStore';
import { useDraftStore } from '../stores/useDraftStore';
import { usePlayerPoolStore } from '../stores/usePlayerPoolStore';
import { useCustomPoolStore } from '../stores/useCustomPoolStore';
import { useCustomTemplatesStore } from '../stores/useCustomTemplatesStore';

interface AuthContextValue {
  isConfigured: boolean;
}

interface TeamDetail {
  name: string;
  playerCount: number;
  playerNames: string[];
}

interface DraftDetail {
  name: string;
}

interface PlayerPoolDetail {
  summonerName: string;
  role: string;
  groupCount: number;
}

interface CustomPoolDetail {
  name: string;
  groupCount: number;
}

interface TemplateDetail {
  name: string;
}

interface PendingMerge {
  session: Session;
  dataSummary: {
    myTeams: TeamDetail[];
    enemyTeams: TeamDetail[];
    drafts: DraftDetail[];
    playerPools: PlayerPoolDetail[];
    customPools: CustomPoolDetail[];
    templates: TemplateDetail[];
    hasData: boolean;
  };
  alreadyInCloud?: AlreadyInCloud;
}

const AuthContext = createContext<AuthContextValue>({ isConfigured: false });

export function AuthProvider({ children }: { children: ReactNode }) {
  const { initialize, setSession, isInitialized } = useAuthStore();
  const [pendingMerge, setPendingMerge] = useState<PendingMerge | null>(null);

  useEffect(() => {
    // Track whether we've already handled the sign-in to prevent race conditions
    let hasHandledSignIn = false;
    let isLoadingCloudData = false;

    // Initialize auth state (just sets up loading state)
    initialize();

    // Try to restore session from localStorage cache immediately
    // This bypasses Supabase's auth methods which can hang on token refresh
    const cachedSession = getCachedSession();
    if (cachedSession && supabase) {
      console.log('Restoring session from localStorage cache, validating...');
      hasHandledSignIn = true;

      // Validate the cached session with Supabase
      const validateAndRestore = async () => {
        try {
          // Quick validation - try to get current user with a timeout
          const { data, error } = await Promise.race([
            supabase.auth.getUser(),
            new Promise<{ data: null; error: Error }>((resolve) =>
              setTimeout(() => resolve({ data: null, error: new Error('Validation timeout') }), 5000)
            ),
          ]);

          if (error || !data?.user) {
            // Session is invalid or validation failed - clear cache and stay logged out
            console.warn('Cached session validation failed, clearing cache:', error?.message || 'No user');
            clearCachedSession();
            hasHandledSignIn = false;
            useAuthStore.setState({ user: null, profile: null, isInitialized: true, isLoading: false });
            return;
          }

          // Session is valid - restore it
          await setSession(cachedSession);

          // Load cloud data and WAIT for it before marking as initialized
          // (prevents app rendering with empty stores before cloud data arrives)
          isLoadingCloudData = true;
          try {
            await Promise.race([
              syncManager.loadAllFromCloud(),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Cloud load timeout')), 15000))
            ]);
          } catch (err) {
            console.warn('Cloud sync failed or timed out:', err);
          } finally {
            isLoadingCloudData = false;
          }

          useAuthStore.setState({ isInitialized: true, isLoading: false });
        } catch (err) {
          // Any error during validation - clear cache and stay logged out
          console.warn('Session validation error, clearing cache:', err);
          clearCachedSession();
          hasHandledSignIn = false;
          useAuthStore.setState({ user: null, profile: null, isInitialized: true, isLoading: false });
        }
      };

      validateAndRestore();
    }

    // Fallback timeout in case INITIAL_SESSION never fires and no cached session
    // Use longer timeout when validating a cached session (validation + cloud data loading)
    const fallbackTimeout = setTimeout(() => {
      if (!useAuthStore.getState().isInitialized) {
        console.warn('Auth initialization fallback - no session found');
        // Clear any stale cache on fallback
        clearCachedSession();
        useAuthStore.setState({ user: null, profile: null, isInitialized: true, isLoading: false });
      }
    }, cachedSession ? 25000 : 3000);

    // Set up auth state listener
    if (isSupabaseConfigured() && supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          console.log('Auth state changed:', event, session?.user?.email, { hasHandledSignIn, isLoadingCloudData });

          // INITIAL_SESSION fires on page load with cached session
          if (event === 'INITIAL_SESSION') {
            if (session && !hasHandledSignIn) {
              hasHandledSignIn = true;
              // Restore session from cache and wait for profile to load
              await setSession(session);
              // Load cloud data and WAIT for it to complete
              isLoadingCloudData = true;
              try {
                await Promise.race([
                  syncManager.loadAllFromCloud(),
                  new Promise((_, reject) => setTimeout(() => reject(new Error('Cloud load timeout')), 15000))
                ]);
              } catch (err) {
                console.warn('Cloud sync failed or timed out:', err);
              } finally {
                isLoadingCloudData = false;
              }
            } else if (session && hasHandledSignIn) {
              // Cached session path (validateAndRestore) is handling initialization.
              // Don't set isInitialized here — validateAndRestore will do it after
              // both session restore AND cloud data loading are complete.
              return;
            }
            // Mark as initialized for no-session case
            useAuthStore.setState({ isInitialized: true, isLoading: false });
            return;
          }

          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            if (event === 'SIGNED_IN' && session) {
              // Skip if we've already handled this sign-in (prevents race condition)
              if (hasHandledSignIn) {
                console.log('Sign-in already handled, skipping duplicate processing');
                // Wait for any ongoing cloud load to finish, with timeout to prevent infinite hang
                const maxWait = 15000; // 15 seconds max
                const startTime = Date.now();
                while (isLoadingCloudData && (Date.now() - startTime) < maxWait) {
                  await new Promise(resolve => setTimeout(resolve, 100));
                }
                if (isLoadingCloudData) {
                  console.warn('Cloud load still in progress after timeout, continuing anyway');
                }
                return;
              }
              hasHandledSignIn = true;

              // Check for local data before completing sign in
              const dataSummary = getLocalDataSummary();

              if (dataSummary.hasData) {
                // Fetch cloud data to compare with local data
                let alreadyInCloud: AlreadyInCloud | undefined;
                try {
                  const cloudData = await syncManager.fetchCloudDataForComparison(session.user.id);
                  if (cloudData) {
                    const localDataWithIds = getLocalDataWithIds();
                    alreadyInCloud = compareLocalWithCloud(localDataWithIds, cloudData);
                  }
                } catch (error) {
                  console.warn('Failed to fetch cloud data for comparison:', error);
                }

                // Store the pending session and show modal
                setPendingMerge({ session, dataSummary, alreadyInCloud });
                return; // Don't complete sign in yet
              }

              // No local data - just load from cloud
              await setSession(session);
              // Load from cloud with timeout to prevent hanging
              isLoadingCloudData = true;
              try {
                await Promise.race([
                  syncManager.loadAllFromCloud(),
                  new Promise((_, reject) => setTimeout(() => reject(new Error('Cloud load timeout')), 15000))
                ]);
              } catch (error) {
                console.warn('Cloud sync failed or timed out, continuing with local data:', error);
              } finally {
                isLoadingCloudData = false;
              }
            } else if (event === 'TOKEN_REFRESHED') {
              await setSession(session);
            }
          } else if (event === 'USER_UPDATED') {
            // Fires after email change confirmation — refresh session and profile
            if (session) {
              await setSession(session);
            }
          } else if (event === 'SIGNED_OUT') {
            hasHandledSignIn = false;
            setSession(null);
          }
        }
      );

      return () => {
        clearTimeout(fallbackTimeout);
        subscription.unsubscribe();
      };
    }

    return () => {
      clearTimeout(fallbackTimeout);
    };
  }, [initialize, setSession]);

  // Handle user choosing to upload local data
  const handleUploadLocalData = async (excluded: ExcludedItems) => {
    if (!pendingMerge) return;

    // Remove excluded items from stores before syncing
    const { dataSummary } = pendingMerge;

    // Filter out excluded my teams
    if (excluded.myTeams.size > 0) {
      const currentTeams = useMyTeamStore.getState().teams;
      // Map the summary index to actual team (based on teams that matched the summary criteria)
      const meaningfulTeamIndices: number[] = [];
      currentTeams.forEach((team, idx) => {
        const hasCustomName = team.name && team.name !== 'My Team';
        const hasPlayers = team.players.some(p => p.summonerName?.trim());
        if (hasCustomName || hasPlayers) {
          meaningfulTeamIndices.push(idx);
        }
      });
      const indicesToRemove = new Set(
        Array.from(excluded.myTeams).map(summaryIdx => meaningfulTeamIndices[summaryIdx])
      );
      const filteredTeams = currentTeams.filter((_, idx) => !indicesToRemove.has(idx));
      useMyTeamStore.setState({ teams: filteredTeams });
    }

    // Filter out excluded enemy teams
    if (excluded.enemyTeams.size > 0) {
      const currentTeams = useEnemyTeamStore.getState().teams;
      const filteredTeams = currentTeams.filter((_, idx) => !excluded.enemyTeams.has(idx));
      useEnemyTeamStore.setState({ teams: filteredTeams });
    }

    // Filter out excluded drafts
    if (excluded.drafts.size > 0) {
      const currentSessions = useDraftStore.getState().sessions;
      const filteredSessions = currentSessions.filter((_, idx) => !excluded.drafts.has(idx));
      useDraftStore.setState({ sessions: filteredSessions });
    }

    // Filter out excluded player pools
    if (excluded.playerPools.size > 0) {
      const currentPools = usePlayerPoolStore.getState().pools;
      // Map summary index to actual pool (pools with summoner name)
      const meaningfulPoolIndices: number[] = [];
      currentPools.forEach((pool, idx) => {
        if (pool.summonerName?.trim()) {
          meaningfulPoolIndices.push(idx);
        }
      });
      const indicesToRemove = new Set(
        Array.from(excluded.playerPools).map(summaryIdx => meaningfulPoolIndices[summaryIdx])
      );
      const filteredPools = currentPools.filter((_, idx) => !indicesToRemove.has(idx));
      usePlayerPoolStore.setState({ pools: filteredPools });
    }

    // Filter out excluded custom pools
    if (excluded.customPools.size > 0) {
      const currentPools = useCustomPoolStore.getState().pools;
      const filteredPools = currentPools.filter((_, idx) => !excluded.customPools.has(idx));
      useCustomPoolStore.setState({ pools: filteredPools });
    }

    // Filter out excluded templates
    if (excluded.templates.size > 0) {
      const currentTemplates = useCustomTemplatesStore.getState().templates;
      const filteredTemplates = currentTemplates.filter((_, idx) => !excluded.templates.has(idx));
      useCustomTemplatesStore.setState({ templates: filteredTemplates });
    }

    // Complete the sign in and wait for profile to load
    await setSession(pendingMerge.session);

    // Sync local data to cloud with timeout
    try {
      await Promise.race([
        syncManager.syncAllStores(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Upload timeout')), 30000))
      ]);
    } catch (error) {
      console.warn('Cloud upload failed or timed out:', error);
    }

    // Clear the pending state
    setPendingMerge(null);
  };

  // Handle user choosing to discard local data
  const handleDiscardLocalData = async () => {
    if (!pendingMerge) return;

    // Complete the sign in and wait for profile to load
    await setSession(pendingMerge.session);

    // Clear local stores and load from cloud
    // We need to clear localStorage first, then load cloud data
    // Note: We don't clear settings (user preferences) or auth state
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

    // Load from cloud with timeout
    try {
      await Promise.race([
        syncManager.loadAllFromCloud(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Cloud load timeout')), 15000))
      ]);
    } catch (error) {
      console.warn('Cloud load failed or timed out:', error);
    }

    // Clear the pending state
    setPendingMerge(null);
  };

  // Show loading state until auth is initialized
  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-lol-gray flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <img
            src="/images/logo.png"
            alt="teamcomp.lol logo"
            className="size-16"
          />
          <div className="text-gray-400 text-sm">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ isConfigured: isSupabaseConfigured() }}>
      {children}
      {/* Local data merge modal */}
      <LocalDataMergeModal
        isOpen={pendingMerge !== null}
        dataSummary={pendingMerge?.dataSummary ?? { myTeams: [], enemyTeams: [], drafts: [], playerPools: [], customPools: [], templates: [], hasData: false }}
        alreadyInCloud={pendingMerge?.alreadyInCloud}
        onUpload={handleUploadLocalData}
        onDiscard={handleDiscardLocalData}
      />
    </AuthContext.Provider>
  );
}

export const useAuthContext = () => useContext(AuthContext);
