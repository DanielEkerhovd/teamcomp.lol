import { supabase, isSupabaseConfigured } from './supabase';
import { useAuthStore } from '../stores/useAuthStore';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

interface SyncState {
  status: SyncStatus;
  lastSyncedAt: number | null;
  error: string | null;
}

// Pending sync data - stored so we can flush on page unload
interface PendingSync {
  type: 'single' | 'array' | 'players';
  storeKey: string;
  tableName: string;
  data: unknown;
  options: unknown;
}

// Global sync state
const syncStates: Map<string, SyncState> = new Map();
const syncListeners: Map<string, Set<(state: SyncState) => void>> = new Map();

// Debounce timers
const debounceTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

// Pending syncs - keyed by storeKey, stores the data to sync
const pendingSyncs: Map<string, PendingSync> = new Map();

// Helper to add small delay between Supabase operations to prevent lock contention
const throttleDelay = (ms: number = 100) => new Promise(resolve => setTimeout(resolve, ms));

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
    const { debounceMs = 3000, transform, upsertKey = 'user_id' } = options;

    // Store pending sync data for potential flush on page unload
    pendingSyncs.set(storeKey, {
      type: 'single',
      storeKey,
      tableName,
      data,
      options: { transform, upsertKey },
    });

    // Clear existing timer
    const existingTimer = debounceTimers.get(storeKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new debounced sync
    const timer = setTimeout(async () => {
      await this._executeSingleSync(storeKey, tableName, data, { transform, upsertKey });
    }, debounceMs);

    debounceTimers.set(storeKey, timer);
  },

  /**
   * Internal: Execute a single object sync immediately
   */
  async _executeSingleSync<T>(
    storeKey: string,
    tableName: string,
    data: T,
    options: {
      transform?: (data: T, userId: string) => unknown;
      upsertKey?: string;
    }
  ): Promise<void> {
    const { transform, upsertKey = 'user_id' } = options;

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

      // Clear from pending syncs on success
      pendingSyncs.delete(storeKey);
      updateSyncState(storeKey, { status: 'synced', lastSyncedAt: Date.now(), error: null });
    } catch (error) {
      console.error(`Sync error for ${storeKey}:`, error);
      updateSyncState(storeKey, {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown sync error',
      });
    }
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
    const { debounceMs = 3000, transformItem, deleteOrphans = true } = options;

    // Store pending sync data for potential flush on page unload
    pendingSyncs.set(storeKey, {
      type: 'array',
      storeKey,
      tableName,
      data: items,
      options: { transformItem, deleteOrphans },
    });

    const existingTimer = debounceTimers.get(storeKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(async () => {
      await this._executeArraySync(storeKey, tableName, items, { transformItem, deleteOrphans });
    }, debounceMs);

    debounceTimers.set(storeKey, timer);
  },

  /**
   * Internal: Execute an array sync immediately
   */
  async _executeArraySync<T extends { id: string }>(
    storeKey: string,
    tableName: string,
    items: T[],
    options: {
      transformItem?: (item: T, userId: string, index: number) => unknown;
      deleteOrphans?: boolean;
    }
  ): Promise<void> {
    const { transformItem, deleteOrphans = true } = options;

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

      // Upsert all items with explicit onConflict
      if (cloudItems.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: upsertError } = await (supabase.from(tableName) as any)
          .upsert(cloudItems as Record<string, unknown>[], { onConflict: 'id' });

        if (upsertError) throw upsertError;
      }

      // Delete orphans (items in cloud but not in local)
      if (deleteOrphans) {
        const localIds = items.map((item) => item.id);
        if (localIds.length > 0) {
          // Delete items that exist in cloud but not locally
          const { error: deleteError } = await supabase
            .from(tableName)
            .delete()
            .eq('user_id', user.id)
            .not('id', 'in', `(${localIds.join(',')})`);

          if (deleteError && !deleteError.message.includes('no rows')) {
            console.warn(`Delete orphans warning for ${storeKey}:`, deleteError);
          }
        } else {
          // All items deleted locally - delete all items in cloud for this user
          const { error: deleteError } = await supabase
            .from(tableName)
            .delete()
            .eq('user_id', user.id);

          if (deleteError && !deleteError.message.includes('no rows')) {
            console.warn(`Delete all warning for ${storeKey}:`, deleteError);
          }
        }
      }

      // Clear from pending syncs on success
      pendingSyncs.delete(storeKey);
      updateSyncState(storeKey, { status: 'synced', lastSyncedAt: Date.now(), error: null });
    } catch (error) {
      console.error(`Sync error for ${storeKey}:`, error);
      updateSyncState(storeKey, {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown sync error',
      });
    }
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
    // Clear the debounce timer
    const timer = debounceTimers.get(storeKey);
    if (timer) {
      clearTimeout(timer);
      debounceTimers.delete(storeKey);
    }

    // Execute pending sync if there is one
    const pending = pendingSyncs.get(storeKey);
    if (!pending) return;

    if (pending.type === 'single') {
      const opts = pending.options as { transform?: (data: unknown, userId: string) => unknown; upsertKey?: string };
      await this._executeSingleSync(pending.storeKey, pending.tableName, pending.data, opts);
    } else if (pending.type === 'array') {
      const opts = pending.options as { transformItem?: (item: { id: string }, userId: string, index: number) => unknown; deleteOrphans?: boolean };
      await this._executeArraySync(pending.storeKey, pending.tableName, pending.data as { id: string }[], opts);
    } else if (pending.type === 'players') {
      const opts = pending.options as { teamId: string };
      await this._executePlayersSync(pending.storeKey, pending.tableName as 'players' | 'enemy_players', opts.teamId, pending.data as Parameters<typeof this.syncPlayersToCloud>[3]);
    }
  },

  /**
   * Flush all pending syncs immediately (called on page unload)
   * Uses navigator.sendBeacon for reliability during page unload
   */
  async flushPendingSyncs(): Promise<void> {
    if (!this.isAvailable() || !supabase) return;

    const promises: Promise<void>[] = [];

    // Clear all debounce timers
    for (const [key, timer] of debounceTimers) {
      clearTimeout(timer);
      debounceTimers.delete(key);
    }

    // Execute all pending syncs
    for (const [storeKey, pending] of pendingSyncs) {
      if (pending.type === 'single') {
        const opts = pending.options as { transform?: (data: unknown, userId: string) => unknown; upsertKey?: string };
        promises.push(this._executeSingleSync(storeKey, pending.tableName, pending.data, opts));
      } else if (pending.type === 'array') {
        const opts = pending.options as { transformItem?: (item: { id: string }, userId: string, index: number) => unknown; deleteOrphans?: boolean };
        promises.push(this._executeArraySync(storeKey, pending.tableName, pending.data as { id: string }[], opts));
      } else if (pending.type === 'players') {
        const opts = pending.options as { teamId: string };
        promises.push(this._executePlayersSync(storeKey, pending.tableName as 'players' | 'enemy_players', opts.teamId, pending.data as Parameters<typeof this.syncPlayersToCloud>[3]));
      }
    }

    // Wait for all syncs to complete
    await Promise.allSettled(promises);
  },

  /**
   * Check if there are any pending syncs
   */
  hasPendingSyncs(): boolean {
    return pendingSyncs.size > 0;
  },

  /**
   * Resolve team name conflicts before syncing to cloud
   * Returns the teams with any conflicting names renamed
   */
  async resolveTeamNameConflicts<T extends { id: string; name: string }>(
    tableName: 'my_teams' | 'enemy_teams',
    localTeams: T[],
    userId: string
  ): Promise<T[]> {
    if (!supabase || localTeams.length === 0) return localTeams;

    try {
      // Fetch existing team names from cloud
      const { data: cloudTeams } = await supabase
        .from(tableName)
        .select('id, name')
        .eq('user_id', userId);

      if (!cloudTeams || cloudTeams.length === 0) return localTeams;

      // Build a set of existing names (lowercase for case-insensitive comparison)
      // Exclude teams that have the same ID (they're being updated, not conflicting)
      const localIds = new Set(localTeams.map(t => t.id));
      const existingNames = new Set(
        cloudTeams
          .filter(t => !localIds.has(t.id))
          .map(t => t.name.toLowerCase())
      );

      // Also track names we're about to use (to avoid local-to-local conflicts after renaming)
      const usedNames = new Set(existingNames);

      // Resolve conflicts
      return localTeams.map(team => {
        const normalizedName = team.name.toLowerCase();

        if (!usedNames.has(normalizedName)) {
          usedNames.add(normalizedName);
          return team;
        }

        // Name conflicts - find a unique name
        let counter = 2;
        let newName = `${team.name} (${counter})`;
        while (usedNames.has(newName.toLowerCase())) {
          counter++;
          newName = `${team.name} (${counter})`;
        }

        usedNames.add(newName.toLowerCase());
        console.log(`Renamed team "${team.name}" to "${newName}" to avoid conflict`);
        return { ...team, name: newName };
      });
    } catch (error) {
      console.error('Error resolving team name conflicts:', error);
      return localTeams;
    }
  },

  /**
   * Sync all stores to cloud (called on login to upload guest data)
   */
  async syncAllStores(): Promise<void> {
    if (!this.isAvailable() || !supabase) return;

    const { user } = useAuthStore.getState();
    if (!user) return;

    // Import stores dynamically to avoid circular deps at module load
    const { useMyTeamStore } = await import('../stores/useMyTeamStore');
    const { useEnemyTeamStore } = await import('../stores/useEnemyTeamStore');
    const { useDraftStore } = await import('../stores/useDraftStore');
    const { usePlayerPoolStore } = await import('../stores/usePlayerPoolStore');

    // Sync my teams (resolve name conflicts first)
    let myTeams = useMyTeamStore.getState().teams;
    myTeams = await this.resolveTeamNameConflicts('my_teams', myTeams, user.id);

    // Update local store if any names were changed
    const originalTeams = useMyTeamStore.getState().teams;
    if (myTeams.some((t, i) => t.name !== originalTeams[i]?.name)) {
      useMyTeamStore.setState({ teams: myTeams });
    }
    if (myTeams.length > 0) {
      await this.syncArrayToCloudImmediate('my-teams', 'my_teams', myTeams, {
        transformItem: (team, userId, index) => ({
          id: team.id,
          user_id: userId,
          name: team.name,
          notes: team.notes,
          champion_pool: team.championPool || [],
          sort_order: index,
        }),
      });

      // Sync players for each team
      const { findPool } = usePlayerPoolStore.getState();
      for (const team of myTeams) {
        const enrichedPlayers = team.players.map((player) => {
          const pool = player.summonerName ? findPool(player.summonerName, player.role) : null;
          return {
            ...player,
            championGroups: pool?.championGroups || player.championGroups || [],
          };
        });
        await this.syncPlayersToCloudImmediate('players', team.id, enrichedPlayers);
      }
    }

    // Sync enemy teams (resolve name conflicts first)
    let enemyTeams = useEnemyTeamStore.getState().teams;
    enemyTeams = await this.resolveTeamNameConflicts('enemy_teams', enemyTeams, user.id);

    // Update local store if any names were changed
    const originalEnemyTeams = useEnemyTeamStore.getState().teams;
    if (enemyTeams.some((t, i) => t.name !== originalEnemyTeams[i]?.name)) {
      useEnemyTeamStore.setState({ teams: enemyTeams });
    }

    if (enemyTeams.length > 0) {
      await this.syncArrayToCloudImmediate('enemy-teams', 'enemy_teams', enemyTeams, {
        transformItem: (team, userId, index) => ({
          id: team.id,
          user_id: userId,
          name: team.name,
          notes: team.notes,
          is_favorite: team.isFavorite ?? false,
        }),
      });

      // Sync players for each enemy team
      for (const team of enemyTeams) {
        await this.syncPlayersToCloudImmediate('enemy_players', team.id, team.players);
      }
    }

    // Sync draft sessions
    const sessions = useDraftStore.getState().sessions;
    if (sessions.length > 0) {
      await this.syncArrayToCloudImmediate('draft-sessions', 'draft_sessions', sessions, {
        transformItem: (session, userId, index) => ({
          id: session.id,
          user_id: userId,
          name: session.name,
          enemy_team_id: session.enemyTeamId || null,
          my_team_id: session.myTeamId || null,
          ban_groups: session.banGroups || [],
          priority_groups: session.priorityGroups || [],
          notes: session.notes,
          notepad: session.notepad || [],
          sort_order: index,
        }),
      });
    }

    // Sync player pools
    const playerPools = usePlayerPoolStore.getState().pools;
    if (playerPools.length > 0) {
      await this.syncArrayToCloudImmediate('player-pools', 'player_pools', playerPools, {
        transformItem: (pool, userId) => ({
          id: pool.id,
          user_id: userId,
          summoner_name: pool.summonerName,
          tag_line: pool.tagLine || '',
          role: pool.role,
          champion_groups: pool.championGroups || [],
          allow_duplicate_champions: pool.allowDuplicateChampions || false,
        }),
      });
    }

    // Sync custom pools
    const { useCustomPoolStore } = await import('../stores/useCustomPoolStore');
    const customPools = useCustomPoolStore.getState().pools;
    if (customPools.length > 0) {
      await this.syncArrayToCloudImmediate('custom-pools', 'custom_pools', customPools, {
        transformItem: (pool, userId, index) => ({
          id: pool.id,
          user_id: userId,
          name: pool.name,
          champion_groups: pool.championGroups || [],
          allow_duplicate_champions: pool.allowDuplicateChampions || false,
          sort_order: index,
        }),
      });
    }

    // Sync custom templates
    const { useCustomTemplatesStore } = await import('../stores/useCustomTemplatesStore');
    const templates = useCustomTemplatesStore.getState().templates;
    if (templates.length > 0) {
      await this.syncArrayToCloudImmediate('custom-templates', 'custom_templates', templates, {
        transformItem: (template, userId, index) => ({
          id: template.id,
          user_id: userId,
          name: template.name,
          groups: template.groups || [],
          allow_duplicates: template.allowDuplicates || false,
          sort_order: index,
        }),
      });
    }

    // Sync user settings
    const { useSettingsStore } = await import('../stores/useSettingsStore');
    const settings = useSettingsStore.getState();
    await this.syncToCloudImmediate('settings', 'user_settings', {
      user_id: user.id,
      default_region: settings.defaultRegion,
      has_completed_onboarding: settings.hasCompletedOnboarding,
    });

    // Sync draft theory state
    const { useDraftTheoryStore } = await import('../stores/useDraftTheoryStore');
    const draftTheory = useDraftTheoryStore.getState();
    await this.syncToCloudImmediate('draft-theory', 'draft_theory', {
      user_id: user.id,
      blue_bans: draftTheory.blueBans,
      blue_picks: draftTheory.bluePicks,
      red_bans: draftTheory.redBans,
      red_picks: draftTheory.redPicks,
      blue_team_name: draftTheory.blueTeamName,
      red_team_name: draftTheory.redTeamName,
    });

    console.log('All stores synced to cloud');
  },

  /**
   * Sync single object immediately (no debounce) - used by syncAllStores
   */
  async syncToCloudImmediate(
    storeKey: string,
    tableName: string,
    data: Record<string, unknown>
  ): Promise<void> {
    if (!this.isAvailable() || !supabase) return;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from(tableName) as any)
        .upsert(data, { onConflict: 'user_id' });

      if (error) throw error;
    } catch (error) {
      console.error(`Immediate sync error for ${storeKey}:`, error);
    }
  },

  /**
   * Sync array data immediately (no debounce) - used by syncAllStores
   */
  async syncArrayToCloudImmediate<T extends { id: string }>(
    storeKey: string,
    tableName: string,
    items: T[],
    options: {
      transformItem?: (item: T, userId: string, index: number) => unknown;
    } = {}
  ): Promise<void> {
    if (!this.isAvailable() || !supabase) return;

    const { user } = useAuthStore.getState();
    if (!user) return;

    const { transformItem } = options;

    try {
      const cloudItems = items.map((item, index) =>
        transformItem
          ? transformItem(item, user.id, index)
          : { ...item, user_id: user.id, sort_order: index }
      );

      if (cloudItems.length > 0) {
        // Add throttle delay to prevent Navigator LockManager contention
        await throttleDelay(150);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: upsertError } = await (supabase.from(tableName) as any)
          .upsert(cloudItems as Record<string, unknown>[]);

        if (upsertError) throw upsertError;
      }
    } catch (error) {
      // Silently handle lock timeout errors during initial sync
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('LockManager') || errorMessage.includes('timed out')) {
        console.debug(`Sync deferred for ${storeKey} due to lock contention`);
      } else {
        console.error(`Immediate sync error for ${storeKey}:`, error);
      }
    }
  },

  /**
   * Sync players immediately (no debounce) - used by syncAllStores
   */
  async syncPlayersToCloudImmediate(
    tableName: 'players' | 'enemy_players',
    teamId: string,
    players: Array<{
      id: string;
      summonerName: string;
      tagLine?: string;
      role: string;
      notes?: string;
      region?: string;
      isSub?: boolean;
      championPool?: unknown;
      championGroups?: unknown;
    }>
  ): Promise<void> {
    if (!this.isAvailable() || !supabase) return;

    const validRoles = ['top', 'jungle', 'mid', 'adc', 'support'];

    try {
      const cloudPlayers = players.map((player, index) => {
        let championGroups = player.championGroups || [];
        const championPool = player.championPool || [];

        if ((!championGroups || (championGroups as unknown[]).length === 0) &&
            Array.isArray(championPool) && championPool.length > 0) {
          const championIds = championPool.map((item: unknown) => {
            if (typeof item === 'string') return item;
            if (item && typeof item === 'object' && 'championId' in item) {
              return (item as { championId: string }).championId;
            }
            return null;
          }).filter((id): id is string => id !== null);

          if (championIds.length > 0) {
            championGroups = [{ id: `pool-${player.id}`, name: 'Pool', championIds }];
          }
        }

        return {
          id: player.id,
          team_id: teamId,
          summoner_name: player.summonerName,
          tag_line: player.tagLine || '',
          role: validRoles.includes(player.role) ? player.role : 'mid',
          notes: player.notes || '',
          region: player.region || 'euw',
          is_sub: player.isSub || false,
          champion_groups: championGroups,
          sort_order: index,
        };
      });

      if (cloudPlayers.length > 0) {
        // Add throttle delay to prevent Navigator LockManager contention
        await throttleDelay(150);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: upsertError } = await (supabase.from(tableName) as any)
          .upsert(cloudPlayers as Record<string, unknown>[]);

        if (upsertError) throw upsertError;
      }
    } catch (error) {
      // Silently handle lock timeout errors during initial sync
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('LockManager') || errorMessage.includes('timed out')) {
        console.debug(`Player sync deferred for ${tableName} due to lock contention`);
      } else {
        console.error(`Immediate player sync error for ${tableName}:`, error);
      }
    }
  },

  /**
   * Load all data from cloud and reset local stores
   * Called after login when user chooses to discard local data
   */
  async loadAllFromCloud(): Promise<void> {
    if (!this.isAvailable() || !supabase) return;

    const { user } = useAuthStore.getState();
    if (!user) return;

    try {
      // Import stores dynamically
      const { useMyTeamStore } = await import('../stores/useMyTeamStore');
      const { useEnemyTeamStore } = await import('../stores/useEnemyTeamStore');
      const { useDraftStore } = await import('../stores/useDraftStore');
      const { usePlayerPoolStore } = await import('../stores/usePlayerPoolStore');

      // Load my teams with players
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: myTeams } = await (supabase as any)
        .from('my_teams')
        .select('*')
        .eq('user_id', user.id)
        .order('sort_order');

      if (myTeams && myTeams.length > 0) {
        // Preserve the current selectedTeamId if possible
        const currentSelectedTeamId = useMyTeamStore.getState().selectedTeamId;

        const teamsWithPlayers = await Promise.all(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          myTeams.map(async (team: any) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: players } = await (supabase as any)
              .from('players')
              .select('*')
              .eq('team_id', team.id)
              .order('sort_order');

            return {
              id: team.id,
              name: team.name,
              notes: team.notes || '',
              championPool: team.champion_pool || [],
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              players: (players || []).map((p: any) => ({
                id: p.id,
                summonerName: p.summoner_name,
                tagLine: p.tag_line || '',
                role: p.role,
                notes: p.notes || '',
                region: p.region || 'euw',
                isSub: p.is_sub || false,
                championPool: p.champion_pool || [],
                championGroups: p.champion_groups || [],
              })),
              createdAt: new Date(team.created_at).getTime(),
              updatedAt: new Date(team.updated_at).getTime(),
            };
          })
        );

        // Check if the previously selected team still exists in the loaded data
        const selectedTeamExists = teamsWithPlayers.some(t => t.id === currentSelectedTeamId);
        const newSelectedTeamId = selectedTeamExists ? currentSelectedTeamId : (teamsWithPlayers[0]?.id || '');

        // Reset the store with cloud data, preserving selection if valid
        useMyTeamStore.setState({
          teams: teamsWithPlayers,
          selectedTeamId: newSelectedTeamId,
        });
      } else {
        // No cloud data - check if we have local data to preserve
        const localTeams = useMyTeamStore.getState().teams;
        if (localTeams.length === 0) {
          // No local data either - keep empty state (user can create teams manually)
          useMyTeamStore.setState({
            teams: [],
            selectedTeamId: '',
          });
        } else {
          // Preserve local data and immediately sync to cloud
          console.log('Cloud teams empty but local has data, syncing local to cloud');
          // Trigger immediate sync of local data to cloud
          await this.syncArrayToCloudImmediate('my-teams', 'my_teams', localTeams, {
            transformItem: (team, oduserId, index) => ({
              id: team.id,
              user_id: oduserId,
              name: team.name,
              notes: team.notes,
              champion_pool: team.championPool || [],
              sort_order: index,
            }),
          });
          // Also sync players for each team
          for (const team of localTeams) {
            await this.syncPlayersToCloudImmediate('players', team.id, team.players);
          }
        }
      }

      // Load enemy teams with players
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: enemyTeams } = await (supabase as any)
        .from('enemy_teams')
        .select('*')
        .eq('user_id', user.id)
        .order('sort_order');

      if (enemyTeams && enemyTeams.length > 0) {
        const teamsWithPlayers = await Promise.all(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          enemyTeams.map(async (team: any) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: players } = await (supabase as any)
              .from('enemy_players')
              .select('*')
              .eq('team_id', team.id)
              .order('sort_order');

            return {
              id: team.id,
              name: team.name,
              notes: team.notes || '',
              isFavorite: team.is_favorite || false,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              players: (players || []).map((p: any) => ({
                id: p.id,
                summonerName: p.summoner_name,
                tagLine: p.tag_line || '',
                role: p.role,
                notes: p.notes || '',
                region: p.region || 'euw',
                isSub: p.is_sub || false,
                championPool: p.champion_pool || [],
                championGroups: p.champion_groups || [],
              })),
              createdAt: new Date(team.created_at).getTime(),
              updatedAt: new Date(team.updated_at).getTime(),
            };
          })
        );

        useEnemyTeamStore.setState({ teams: teamsWithPlayers });
      } else {
        // Cloud is empty - check if we have local data to preserve
        const localTeams = useEnemyTeamStore.getState().teams;
        if (localTeams.length === 0) {
          useEnemyTeamStore.setState({ teams: [] });
        } else {
          // Preserve local data and immediately sync to cloud
          console.log('Cloud enemy teams empty but local has data, syncing local to cloud');
          await this.syncArrayToCloudImmediate('enemy-teams', 'enemy_teams', localTeams, {
            transformItem: (team, oduserId, index) => ({
              id: team.id,
              user_id: oduserId,
              name: team.name,
              notes: team.notes,
              is_favorite: team.isFavorite ?? false,
              sort_order: index,
            }),
          });
          // Also sync players for each enemy team
          for (const team of localTeams) {
            await this.syncPlayersToCloudImmediate('enemy_players', team.id, team.players);
          }
        }
      }

      // Load draft sessions
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: sessions } = await (supabase as any)
        .from('draft_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('sort_order');

      if (sessions && sessions.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const transformedSessions = sessions.map((s: any) => ({
          id: s.id,
          name: s.name,
          enemyTeamId: s.enemy_team_id,
          myTeamId: s.my_team_id,
          banGroups: s.ban_groups || [],
          priorityGroups: s.priority_groups || [],
          notes: s.notes || '',
          notepad: s.notepad || [],
          createdAt: new Date(s.created_at).getTime(),
          updatedAt: new Date(s.updated_at).getTime(),
        }));

        useDraftStore.setState({
          sessions: transformedSessions,
          currentSessionId: null,
        });
      } else {
        // Cloud is empty - check if we have local data to preserve
        const localSessions = useDraftStore.getState().sessions;
        if (localSessions.length === 0) {
          useDraftStore.setState({ sessions: [], currentSessionId: null });
        } else {
          // Preserve local data and immediately sync to cloud
          console.log('Cloud draft sessions empty but local has data, syncing local to cloud');
          await this.syncArrayToCloudImmediate('draft-sessions', 'draft_sessions', localSessions, {
            transformItem: (session, oduserId, index) => ({
              id: session.id,
              user_id: oduserId,
              name: session.name,
              enemy_team_id: session.enemyTeamId || null,
              my_team_id: session.myTeamId || null,
              ban_groups: session.banGroups || [],
              priority_groups: session.priorityGroups || [],
              notes: session.notes,
              notepad: session.notepad || [],
              sort_order: index,
            }),
          });
        }
      }

      // Load player pools (if table exists)
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: pools } = await (supabase as any)
          .from('player_pools')
          .select('*')
          .eq('user_id', user.id);

        if (pools && pools.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const transformedPools = pools.map((p: any) => ({
            id: p.id,
            summonerName: p.summoner_name,
            tagLine: p.tag_line || '',
            role: p.role,
            championGroups: p.champion_groups || [],
            allowDuplicateChampions: p.allow_duplicate_champions || false,
            updatedAt: Date.now(),
          }));

          usePlayerPoolStore.setState({ pools: transformedPools });
        } else {
          // Cloud is empty - check if we have local data to preserve
          const localPools = usePlayerPoolStore.getState().pools;
          if (localPools.length > 0) {
            // Preserve local data and immediately sync to cloud
            console.log('Cloud pools empty but local has data, syncing local to cloud');
            await this.syncArrayToCloudImmediate('player-pools', 'player_pools', localPools, {
              transformItem: (pool, oduserId) => ({
                id: pool.id,
                user_id: oduserId,
                summoner_name: pool.summonerName,
                tag_line: pool.tagLine || '',
                role: pool.role,
                champion_groups: pool.championGroups || [],
                allow_duplicate_champions: pool.allowDuplicateChampions || false,
              }),
            });
          } else {
            usePlayerPoolStore.setState({ pools: [] });
          }
        }
      } catch {
        // Player pools table might not exist - preserve local data
        const localPools = usePlayerPoolStore.getState().pools;
        if (localPools.length === 0) {
          usePlayerPoolStore.setState({ pools: [] });
        }
        // If local has data, preserve it
      }

      // Load custom pools
      try {
        const { useCustomPoolStore } = await import('../stores/useCustomPoolStore');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: customPools } = await (supabase as any)
          .from('custom_pools')
          .select('*')
          .eq('user_id', user.id)
          .order('sort_order');

        if (customPools && customPools.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const transformedPools = customPools.map((p: any) => ({
            id: p.id,
            name: p.name,
            championGroups: p.champion_groups || [],
            allowDuplicateChampions: p.allow_duplicate_champions || false,
            createdAt: new Date(p.created_at).getTime(),
            updatedAt: new Date(p.updated_at).getTime(),
          }));

          useCustomPoolStore.setState({ pools: transformedPools, selectedPoolId: null });
        } else {
          // Cloud is empty - check if we have local data to preserve
          const localPools = useCustomPoolStore.getState().pools;
          if (localPools.length === 0) {
            useCustomPoolStore.setState({ pools: [], selectedPoolId: null });
          } else {
            // Preserve local data and immediately sync to cloud
            console.log('Cloud custom pools empty but local has data, syncing local to cloud');
            await this.syncArrayToCloudImmediate('custom-pools', 'custom_pools', localPools, {
              transformItem: (pool, oduserId, index) => ({
                id: pool.id,
                user_id: oduserId,
                name: pool.name,
                champion_groups: pool.championGroups || [],
                allow_duplicate_champions: pool.allowDuplicateChampions || false,
                sort_order: index,
              }),
            });
          }
        }
      } catch {
        // Custom pools table might not exist - preserve local data
      }

      // Load custom templates
      try {
        const { useCustomTemplatesStore } = await import('../stores/useCustomTemplatesStore');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: templates } = await (supabase as any)
          .from('custom_templates')
          .select('*')
          .eq('user_id', user.id)
          .order('sort_order');

        if (templates && templates.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const transformedTemplates = templates.map((t: any) => ({
            id: t.id,
            name: t.name,
            groups: t.groups || [],
            allowDuplicates: t.allow_duplicates || false,
          }));

          useCustomTemplatesStore.setState({ templates: transformedTemplates });
        } else {
          // Cloud is empty - check if we have local data to preserve
          const localTemplates = useCustomTemplatesStore.getState().templates;
          if (localTemplates.length === 0) {
            useCustomTemplatesStore.setState({ templates: [] });
          } else {
            // Preserve local data and immediately sync to cloud
            console.log('Cloud custom templates empty but local has data, syncing local to cloud');
            await this.syncArrayToCloudImmediate('custom-templates', 'custom_templates', localTemplates, {
              transformItem: (template, oduserId, index) => ({
                id: template.id,
                user_id: oduserId,
                name: template.name,
                groups: template.groups || [],
                allow_duplicates: template.allowDuplicates || false,
                sort_order: index,
              }),
            });
          }
        }
      } catch {
        // Custom templates table might not exist, that's OK
      }

      // Load user settings
      try {
        const { useSettingsStore } = await import('../stores/useSettingsStore');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: settings } = await (supabase as any)
          .from('user_settings')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (settings) {
          useSettingsStore.setState({
            defaultRegion: settings.default_region || 'euw',
            hasCompletedOnboarding: settings.has_completed_onboarding || false,
          });
        }
      } catch {
        // Settings table might not exist or no settings yet, that's OK
      }

      // Load draft theory state
      try {
        const { useDraftTheoryStore } = await import('../stores/useDraftTheoryStore');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: draftTheoryRows } = await (supabase as any)
          .from('draft_theory')
          .select('*')
          .eq('user_id', user.id);
        const draftTheory = draftTheoryRows?.[0] ?? null;

        if (draftTheory) {
          useDraftTheoryStore.setState({
            blueBans: draftTheory.blue_bans || [null, null, null, null, null],
            bluePicks: draftTheory.blue_picks || [null, null, null, null, null],
            redBans: draftTheory.red_bans || [null, null, null, null, null],
            redPicks: draftTheory.red_picks || [null, null, null, null, null],
            blueTeamName: draftTheory.blue_team_name || 'Blue Side',
            redTeamName: draftTheory.red_team_name || 'Red Side',
          });
        }
      } catch {
        // Draft theory table might not exist or no state yet, that's OK
      }

      console.log('All data loaded from cloud');
    } catch (error) {
      console.error('Error loading from cloud:', error);
    }
  },

  /**
   * Fetch full cloud data for deep comparison during merge
   * Used to identify which local items are identical to cloud data
   */
  async fetchCloudDataForComparison(userId: string): Promise<{
    myTeams: Map<string, { name: string; notes: string; players: Array<{ summonerName: string; role: string; championGroups: unknown }> }>;
    enemyTeams: Map<string, { name: string; notes: string; players: Array<{ summonerName: string; role: string; championGroups: unknown }> }>;
    drafts: Map<string, { name: string; enemyTeamId: string | null; myTeamId: string | null; banGroups: unknown; priorityGroups: unknown }>;
    playerPools: Map<string, { summonerName: string; role: string; championGroups: unknown }>;
    customPools: Map<string, { name: string; championGroups: unknown }>;
    templates: Map<string, { name: string; groups: unknown }>;
  } | null> {
    if (!isSupabaseConfigured() || !supabase) {
      return null;
    }

    try {
      // Fetch all data in parallel
      const [
        myTeamsRes,
        enemyTeamsRes,
        draftsRes,
        playerPoolsRes,
        customPoolsRes,
        templatesRes,
      ] = await Promise.all([
        supabase.from('my_teams').select('id, name, notes').eq('user_id', userId),
        supabase.from('enemy_teams').select('id, name, notes').eq('user_id', userId),
        supabase.from('draft_sessions').select('id, name, enemy_team_id, my_team_id, ban_groups, priority_groups').eq('user_id', userId),
        supabase.from('player_pools').select('id, summoner_name, role, champion_groups').eq('user_id', userId),
        supabase.from('custom_pools').select('id, name, champion_groups').eq('user_id', userId),
        supabase.from('custom_templates').select('id, name, groups').eq('user_id', userId),
      ]);

      // Fetch players for each team
      const myTeamIds = (myTeamsRes.data || []).map((t: { id: string }) => t.id);
      const enemyTeamIds = (enemyTeamsRes.data || []).map((t: { id: string }) => t.id);

      const [playersRes, enemyPlayersRes] = await Promise.all([
        myTeamIds.length > 0
          ? supabase.from('players').select('team_id, summoner_name, role, champion_groups').in('team_id', myTeamIds)
          : Promise.resolve({ data: [] }),
        enemyTeamIds.length > 0
          ? supabase.from('enemy_players').select('team_id, summoner_name, role, champion_groups').in('team_id', enemyTeamIds)
          : Promise.resolve({ data: [] }),
      ]);

      // Group players by team
      const playersByTeam = new Map<string, Array<{ summonerName: string; role: string; championGroups: unknown }>>();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (playersRes.data || []).forEach((p: any) => {
        if (!playersByTeam.has(p.team_id)) {
          playersByTeam.set(p.team_id, []);
        }
        playersByTeam.get(p.team_id)!.push({
          summonerName: p.summoner_name,
          role: p.role,
          championGroups: p.champion_groups,
        });
      });

      const enemyPlayersByTeam = new Map<string, Array<{ summonerName: string; role: string; championGroups: unknown }>>();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (enemyPlayersRes.data || []).forEach((p: any) => {
        if (!enemyPlayersByTeam.has(p.team_id)) {
          enemyPlayersByTeam.set(p.team_id, []);
        }
        enemyPlayersByTeam.get(p.team_id)!.push({
          summonerName: p.summoner_name,
          role: p.role,
          championGroups: p.champion_groups,
        });
      });

      // Build result maps
      const myTeams = new Map();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (myTeamsRes.data || []).forEach((t: any) => {
        myTeams.set(t.id, {
          name: t.name,
          notes: t.notes || '',
          players: playersByTeam.get(t.id) || [],
        });
      });

      const enemyTeams = new Map();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (enemyTeamsRes.data || []).forEach((t: any) => {
        enemyTeams.set(t.id, {
          name: t.name,
          notes: t.notes || '',
          players: enemyPlayersByTeam.get(t.id) || [],
        });
      });

      const drafts = new Map();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (draftsRes.data || []).forEach((d: any) => {
        drafts.set(d.id, {
          name: d.name,
          enemyTeamId: d.enemy_team_id,
          myTeamId: d.my_team_id,
          banGroups: d.ban_groups,
          priorityGroups: d.priority_groups,
        });
      });

      const playerPools = new Map();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (playerPoolsRes.data || []).forEach((p: any) => {
        playerPools.set(p.id, {
          summonerName: p.summoner_name,
          role: p.role,
          championGroups: p.champion_groups,
        });
      });

      const customPools = new Map();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (customPoolsRes.data || []).forEach((p: any) => {
        customPools.set(p.id, {
          name: p.name,
          championGroups: p.champion_groups,
        });
      });

      const templates = new Map();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (templatesRes.data || []).forEach((t: any) => {
        templates.set(t.id, {
          name: t.name,
          groups: t.groups,
        });
      });

      return { myTeams, enemyTeams, drafts, playerPools, customPools, templates };
    } catch (error) {
      console.error('Error fetching cloud data for comparison:', error);
      return null;
    }
  },

  /**
   * Sync players for a team to the cloud
   * This handles the separate players/enemy_players tables
   */
  async syncPlayersToCloud(
    storeKey: string,
    tableName: 'players' | 'enemy_players',
    teamId: string,
    players: Array<{
      id: string;
      summonerName: string;
      tagLine?: string;
      role: string;
      notes?: string;
      region?: string;
      isSub?: boolean;
      championPool?: unknown;
      championGroups?: unknown;
    }>,
    options: {
      debounceMs?: number;
    } = {}
  ): Promise<void> {
    const { debounceMs = 3000 } = options;
    const fullKey = `${storeKey}:players:${teamId}`;

    // Store pending sync data for potential flush on page unload
    pendingSyncs.set(fullKey, {
      type: 'players',
      storeKey: fullKey,
      tableName,
      data: players,
      options: { teamId },
    });

    const existingTimer = debounceTimers.get(fullKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(async () => {
      await this._executePlayersSync(fullKey, tableName, teamId, players);
    }, debounceMs);

    debounceTimers.set(fullKey, timer);
  },

  /**
   * Internal: Execute a players sync immediately
   */
  async _executePlayersSync(
    fullKey: string,
    tableName: 'players' | 'enemy_players',
    teamId: string,
    players: Array<{
      id: string;
      summonerName: string;
      tagLine?: string;
      role: string;
      notes?: string;
      region?: string;
      isSub?: boolean;
      championPool?: unknown;
      championGroups?: unknown;
    }>
  ): Promise<void> {
    if (!this.isAvailable() || !supabase) {
      return;
    }

    // Valid roles that match database constraint
    const validRoles = ['top', 'jungle', 'mid', 'adc', 'support'];

    try {
      // Filter out empty players (no summoner name) - they shouldn't be synced to cloud
      const nonEmptyPlayers = players.filter(p => p.summonerName.trim() !== '');

      // Transform players for the database
      const cloudPlayers = nonEmptyPlayers.map((player, index) => {
        // Get champion groups - if empty but old championPool has data, convert it
        let championGroups = player.championGroups || [];
        const championPool = player.championPool || [];

        // Convert old tiered championPool to groups format if needed
        if ((!championGroups || (championGroups as unknown[]).length === 0) &&
            Array.isArray(championPool) && championPool.length > 0) {
          // championPool is array of { championId, tier } or just strings
          const championIds = championPool.map((item: unknown) => {
            if (typeof item === 'string') return item;
            if (item && typeof item === 'object' && 'championId' in item) {
              return (item as { championId: string }).championId;
            }
            return null;
          }).filter((id): id is string => id !== null);

          if (championIds.length > 0) {
            championGroups = [{ id: `pool-${player.id}`, name: 'Pool', championIds }];
          }
        }

        return {
          id: player.id,
          team_id: teamId,
          summoner_name: player.summonerName,
          tag_line: player.tagLine || '',
          // Ensure role is valid, default to 'mid' if not
          role: validRoles.includes(player.role) ? player.role : 'mid',
          notes: player.notes || '',
          region: player.region || 'euw',
          is_sub: player.isSub || false,
          champion_groups: championGroups,
          sort_order: index,
        };
      });

      // Upsert all players with explicit onConflict
      if (cloudPlayers.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: upsertError } = await (supabase.from(tableName) as any)
          .upsert(cloudPlayers as Record<string, unknown>[], { onConflict: 'id' });

        if (upsertError) throw upsertError;
      }

      // Delete orphan players and empty players from cloud
      // Only keep non-empty player IDs - this ensures empty players get deleted from cloud
      const localIds = nonEmptyPlayers.map((p) => p.id);
      if (localIds.length > 0) {
        const { error: deleteError } = await supabase
          .from(tableName)
          .delete()
          .eq('team_id', teamId)
          .not('id', 'in', `(${localIds.join(',')})`);

        if (deleteError && !deleteError.message.includes('no rows')) {
          console.warn(`Delete orphan players warning for ${fullKey}:`, deleteError);
        }
      } else {
        // If all players are empty, delete all players for this team from cloud
        const { error: deleteError } = await supabase
          .from(tableName)
          .delete()
          .eq('team_id', teamId);

        if (deleteError && !deleteError.message.includes('no rows')) {
          console.warn(`Delete all players warning for ${fullKey}:`, deleteError);
        }
      }

      // Clear from pending syncs on success
      pendingSyncs.delete(fullKey);
    } catch (error) {
      console.error(`Player sync error for ${fullKey}:`, error);
    }
  },
};

// Set up page unload handlers to flush pending syncs
if (typeof window !== 'undefined') {
  // Handle page visibility change (user switches tabs or minimizes)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && syncManager.hasPendingSyncs()) {
      // Use sendBeacon-friendly approach - trigger sync immediately
      syncManager.flushPendingSyncs();
    }
  });

  // Handle page unload (user closes tab or navigates away)
  window.addEventListener('beforeunload', () => {
    if (syncManager.hasPendingSyncs()) {
      // Flush pending syncs - this may not complete but we try
      syncManager.flushPendingSyncs();
    }
  });

  // Handle page hide (more reliable on mobile)
  window.addEventListener('pagehide', () => {
    if (syncManager.hasPendingSyncs()) {
      syncManager.flushPendingSyncs();
    }
  });
}
