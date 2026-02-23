import { StateCreator, StoreMutatorIdentifier } from 'zustand';
import { syncManager } from '../../lib/syncManager';

/**
 * Cloud sync middleware for Zustand stores
 *
 * This middleware wraps store actions to automatically sync state changes
 * to Supabase when a user is authenticated. It respects the existing
 * persist middleware pattern.
 *
 * Usage:
 * ```ts
 * export const useMyStore = create<MyState>()(
 *   persist(
 *     cloudSync(
 *       (set, get) => ({ ... }),
 *       {
 *         storeKey: 'my-store',
 *         tableName: 'my_table',
 *         selectSyncData: (state) => state.items,
 *       }
 *     ),
 *     { name: 'my-store-local' }
 *   )
 * );
 * ```
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface CloudSyncOptions<T, D = any> {
  /** Unique identifier for this store's sync state */
  storeKey: string;

  /** Supabase table name to sync to */
  tableName: string;

  /** Debounce time in ms before syncing (default: 1000) */
  debounceMs?: number;

  /** Select which part of state to sync (default: entire state) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  selectSyncData?: (state: T) => any;

  /** Transform data before sending to Supabase */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transformForCloud?: (data: D, userId: string) => any;

  /** Whether this is an array sync (uses syncArrayToCloud) */
  isArraySync?: boolean;

  /** For array sync: transform each item */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transformItem?: (item: any, userId: string, index: number) => any;

  /** Skip certain actions from triggering sync */
  skipActions?: string[];

  /** Callback to sync related data after main sync (e.g., players for teams) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onAfterSync?: (data: any, storeKey: string, debounceMs: number) => void;
}

type CloudSync = <
  T,
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = []
>(
  f: StateCreator<T, Mps, Mcs>,
  options: CloudSyncOptions<T>
) => StateCreator<T, Mps, Mcs>;

type CloudSyncImpl = <T>(
  f: StateCreator<T, [], []>,
  options: CloudSyncOptions<T>
) => StateCreator<T, [], []>;

const cloudSyncImpl: CloudSyncImpl = (f, options) => (set, get, store) => {
  const {
    storeKey,
    tableName,
    debounceMs = 1000,
    selectSyncData,
    transformForCloud,
    isArraySync = false,
    transformItem,
    onAfterSync,
  } = options;

  // Wrap the set function to trigger sync after state changes
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const syncingSet: typeof set = (...args: any[]) => {
    // Apply the state change
    (set as (...args: unknown[]) => void)(...args);

    // Check if sync is available (user authenticated + Supabase configured)
    if (!syncManager.isAvailable()) {
      console.log('[CloudSync] Sync not available - skipping');
      return;
    }
    console.log('[CloudSync] Sync available, proceeding with', storeKey);

    // Get the data to sync
    const state = get();
    const dataToSync = selectSyncData ? selectSyncData(state) : state;

    // Trigger appropriate sync
    if (isArraySync && Array.isArray(dataToSync)) {
      syncManager.syncArrayToCloud(storeKey, tableName, dataToSync as { id: string }[], {
        debounceMs,
        transformItem: transformItem as (item: { id: string }, userId: string, index: number) => unknown,
      });
    } else {
      syncManager.syncToCloud(storeKey, tableName, dataToSync, {
        debounceMs,
        transform: transformForCloud as (data: unknown, userId: string) => unknown,
      });
    }

    // Trigger related data sync (e.g., players for teams)
    if (onAfterSync) {
      console.log('[CloudSync] Calling onAfterSync for', storeKey);
      onAfterSync(dataToSync, storeKey, debounceMs);
    }
  };

  // Create the store with wrapped set
  return f(syncingSet, get, store);
};

export const cloudSync = cloudSyncImpl as unknown as CloudSync;

/**
 * Hook to manually trigger a sync or get sync status
 */
export function useSyncStatus(storeKey: string) {
  // This could be expanded to use React state and subscribe to syncManager
  return {
    status: syncManager.getState(storeKey),
    isAvailable: syncManager.isAvailable(),
  };
}
