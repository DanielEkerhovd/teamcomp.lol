import { supabase, isSupabaseConfigured } from './supabase';
import { useAuthStore } from '../stores/useAuthStore';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

interface SyncState {
  status: SyncStatus;
  lastSyncedAt: number | null;
  error: string | null;
}

// Global sync state
const syncStates: Map<string, SyncState> = new Map();
const syncListeners: Map<string, Set<(state: SyncState) => void>> = new Map();

// Debounce timers
const debounceTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

function notifyListeners(storeKey: string, state: SyncState) {
  const listeners = syncListeners.get(storeKey);
  if (listeners) {
    listeners.forEach((listener) => listener(state));
  }
}

function updateSyncState(storeKey: string, updates: Partial<SyncState>) {
  const current = syncStates.get(storeKey) || { status: 'idle', lastSyncedAt: null, error: null };
  const newState = { ...current, ...updates };
  syncStates.set(storeKey, newState);
  notifyListeners(storeKey, newState);
}

export const syncManager = {
  /**
   * Subscribe to sync state changes for a store
   */
  subscribe(storeKey: string, listener: (state: SyncState) => void): () => void {
    if (!syncListeners.has(storeKey)) {
      syncListeners.set(storeKey, new Set());
    }
    syncListeners.get(storeKey)!.add(listener);

    // Immediately notify with current state
    const currentState = syncStates.get(storeKey) || { status: 'idle', lastSyncedAt: null, error: null };
    listener(currentState);

    return () => {
      syncListeners.get(storeKey)?.delete(listener);
    };
  },

  /**
   * Get current sync state for a store
   */
  getState(storeKey: string): SyncState {
    return syncStates.get(storeKey) || { status: 'idle', lastSyncedAt: null, error: null };
  },

  /**
   * Check if cloud sync is available
   */
  isAvailable(): boolean {
    if (!isSupabaseConfigured()) return false;
    const { user } = useAuthStore.getState();
    return !!user;
  },

  /**
   * Sync data to the cloud with debouncing
   */
  async syncToCloud<T>(
    storeKey: string,
    tableName: string,
    data: T,
    options: {
      debounceMs?: number;
      transform?: (data: T, userId: string) => unknown;
      upsertKey?: string;
    } = {}
  ): Promise<void> {
    const { debounceMs = 1000, transform, upsertKey = 'user_id' } = options;

    // Clear existing timer
    const existingTimer = debounceTimers.get(storeKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new debounced sync
    const timer = setTimeout(async () => {
      if (!this.isAvailable() || !supabase) {
        return;
      }

      const { user } = useAuthStore.getState();
      if (!user) return;

      updateSyncState(storeKey, { status: 'syncing', error: null });

      try {
        const cloudData = transform ? transform(data, user.id) : { ...data, user_id: user.id };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from(tableName) as any)
          .upsert(cloudData as Record<string, unknown>, { onConflict: upsertKey });

        if (error) {
          throw error;
        }

        updateSyncState(storeKey, { status: 'synced', lastSyncedAt: Date.now(), error: null });
      } catch (error) {
        console.error(`Sync error for ${storeKey}:`, error);
        updateSyncState(storeKey, {
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown sync error',
        });
      }
    }, debounceMs);

    debounceTimers.set(storeKey, timer);
  },

  /**
   * Sync array data (like teams) to cloud
   */
  async syncArrayToCloud<T extends { id: string }>(
    storeKey: string,
    tableName: string,
    items: T[],
    options: {
      debounceMs?: number;
      transformItem?: (item: T, userId: string, index: number) => unknown;
      deleteOrphans?: boolean;
    } = {}
  ): Promise<void> {
    const { debounceMs = 1000, transformItem, deleteOrphans = true } = options;

    const existingTimer = debounceTimers.get(storeKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(async () => {
      if (!this.isAvailable() || !supabase) {
        return;
      }

      const { user } = useAuthStore.getState();
      if (!user) return;

      updateSyncState(storeKey, { status: 'syncing', error: null });

      try {
        // Transform items
        const cloudItems = items.map((item, index) =>
          transformItem
            ? transformItem(item, user.id, index)
            : { ...item, user_id: user.id, sort_order: index }
        );

        // Upsert all items
        if (cloudItems.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: upsertError } = await (supabase.from(tableName) as any)
            .upsert(cloudItems as Record<string, unknown>[]);

          if (upsertError) throw upsertError;
        }

        // Delete orphans (items in cloud but not in local)
        if (deleteOrphans) {
          const localIds = items.map((item) => item.id);
          const { error: deleteError } = await supabase
            .from(tableName)
            .delete()
            .eq('user_id', user.id)
            .not('id', 'in', `(${localIds.join(',')})`);

          if (deleteError && !deleteError.message.includes('no rows')) {
            console.warn(`Delete orphans warning for ${storeKey}:`, deleteError);
          }
        }

        updateSyncState(storeKey, { status: 'synced', lastSyncedAt: Date.now(), error: null });
      } catch (error) {
        console.error(`Sync error for ${storeKey}:`, error);
        updateSyncState(storeKey, {
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown sync error',
        });
      }
    }, debounceMs);

    debounceTimers.set(storeKey, timer);
  },

  /**
   * Load data from cloud
   */
  async loadFromCloud<T>(
    storeKey: string,
    tableName: string,
    options: {
      transform?: (data: unknown[]) => T;
      orderBy?: string;
    } = {}
  ): Promise<T | null> {
    if (!this.isAvailable() || !supabase) {
      return null;
    }

    const { user } = useAuthStore.getState();
    if (!user) return null;

    const { transform, orderBy } = options;

    try {
      let query = supabase.from(tableName).select('*').eq('user_id', user.id);

      if (orderBy) {
        query = query.order(orderBy);
      }

      const { data, error } = await query;

      if (error) throw error;

      return transform ? transform(data || []) : (data as T);
    } catch (error) {
      console.error(`Load error for ${storeKey}:`, error);
      return null;
    }
  },

  /**
   * Force immediate sync (bypasses debounce)
   */
  async forceSync(storeKey: string): Promise<void> {
    const timer = debounceTimers.get(storeKey);
    if (timer) {
      clearTimeout(timer);
      debounceTimers.delete(storeKey);
    }
    // The actual sync logic would need to be triggered from the store
  },
};
