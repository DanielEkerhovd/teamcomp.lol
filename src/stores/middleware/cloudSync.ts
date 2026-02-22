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

export interface CloudSyncOptions<T, D = T> {
  /** Unique identifier for this store's sync state */
  storeKey: string;

  /** Supabase table name to sync to */
  tableName: string;

  /** Debounce time in ms before syncing (default: 1000) */
  debounceMs?: number;

  /** Select which part of state to sync (default: entire state) */
  selectSyncData?: (state: T) => D;

  /** Transform data before sending to Supabase */
  transformForCloud?: (data: D, userId: string) => unknown;

  /** Whether this is an array sync (uses syncArrayToCloud) */
  isArraySync?: boolean;

  /** For array sync: transform each item */
  transformItem?: (item: unknown, userId: string, index: number) => unknown;

  /** Skip certain actions from triggering sync */
  skipActions?: string[];
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
  } = options;

  // Wrap the set function to trigger sync after state changes
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const syncingSet: typeof set = (...args: any[]) => {
    // Apply the state change
    (set as (...args: unknown[]) => void)(...args);

    // Check if sync is available (user authenticated + Supabase configured)
    if (!syncManager.isAvailable()) {
      return;
    }

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
