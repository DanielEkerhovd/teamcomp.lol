import { supabase, isSupabaseConfigured } from './supabase';
import { useAuthStore } from '../stores/useAuthStore';

// LocalStorage keys used by the app
const STORAGE_KEYS = [
  'teamcomp-lol-my-team',
  'teamcomp-lol-enemy-teams',
  'teamcomp-lol-drafts',
  'teamcomp-lol-player-pools',
  'teamcomp-lol-custom-pools',
  'teamcomp-lol-settings',
  'teamcomp-lol-custom-templates',
  'teamcomp-lol-draft-theory',
  'teamcomp-lol-champion-pool',
] as const;

const MIGRATION_KEY = 'teamcomp-lol-migrated';

export interface LocalStorageData {
  myTeam: unknown;
  enemyTeams: unknown;
  drafts: unknown;
  playerPools: unknown;
  customPools: unknown;
  settings: unknown;
  templates: unknown;
  draftTheory: unknown;
  championPool: unknown;
}

export interface MigrationResult {
  success: boolean;
  migratedStores: string[];
  errors: string[];
}

export const migrationService = {
  /**
   * Check if there's existing localStorage data to migrate
   */
  hasExistingData(): boolean {
    return STORAGE_KEYS.some((key) => {
      const data = localStorage.getItem(key);
      if (!data) return false;
      try {
        const parsed = JSON.parse(data);
        // Check if there's actual content in the state
        return parsed?.state && Object.keys(parsed.state).length > 0;
      } catch {
        return false;
      }
    });
  },

  /**
   * Check if user has already migrated
   */
  hasMigrated(userId: string): boolean {
    const migrated = localStorage.getItem(MIGRATION_KEY);
    if (!migrated) return false;
    try {
      const users = JSON.parse(migrated) as string[];
      return users.includes(userId);
    } catch {
      return false;
    }
  },

  /**
   * Mark user as migrated
   */
  markAsMigrated(userId: string): void {
    let users: string[] = [];
    try {
      const migrated = localStorage.getItem(MIGRATION_KEY);
      if (migrated) {
        users = JSON.parse(migrated);
      }
    } catch {
      users = [];
    }
    if (!users.includes(userId)) {
      users.push(userId);
    }
    localStorage.setItem(MIGRATION_KEY, JSON.stringify(users));
  },

  /**
   * Collect all localStorage data
   */
  collectLocalData(): LocalStorageData {
    const getData = (key: string) => {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed?.state || null;
      } catch {
        return null;
      }
    };

    return {
      myTeam: getData('teamcomp-lol-my-team'),
      enemyTeams: getData('teamcomp-lol-enemy-teams'),
      drafts: getData('teamcomp-lol-drafts'),
      playerPools: getData('teamcomp-lol-player-pools'),
      customPools: getData('teamcomp-lol-custom-pools'),
      settings: getData('teamcomp-lol-settings'),
      templates: getData('teamcomp-lol-custom-templates'),
      draftTheory: getData('teamcomp-lol-draft-theory'),
      championPool: getData('teamcomp-lol-champion-pool'),
    };
  },

  /**
   * Migrate all localStorage data to Supabase
   */
  async migrateToCloud(): Promise<MigrationResult> {
    if (!isSupabaseConfigured() || !supabase) {
      return { success: false, migratedStores: [], errors: ['Supabase not configured'] };
    }

    const { user } = useAuthStore.getState();
    if (!user) {
      return { success: false, migratedStores: [], errors: ['User not authenticated'] };
    }

    const data = this.collectLocalData();
    const migratedStores: string[] = [];
    const errors: string[] = [];

    // Migrate My Teams
    if (data.myTeam && (data.myTeam as { teams?: unknown[] }).teams) {
      try {
        await this.migrateMyTeams(user.id, data.myTeam);
        migratedStores.push('my-teams');
      } catch (error) {
        errors.push(`My Teams: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Migrate Enemy Teams
    if (data.enemyTeams && (data.enemyTeams as { teams?: unknown[] }).teams) {
      try {
        await this.migrateEnemyTeams(user.id, data.enemyTeams);
        migratedStores.push('enemy-teams');
      } catch (error) {
        errors.push(`Enemy Teams: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Migrate Settings
    if (data.settings) {
      try {
        await this.migrateSettings(user.id, data.settings);
        migratedStores.push('settings');
      } catch (error) {
        errors.push(`Settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Migrate Draft Sessions
    if (data.drafts && (data.drafts as { sessions?: unknown[] }).sessions) {
      try {
        await this.migrateDraftSessions(user.id, data.drafts);
        migratedStores.push('draft-sessions');
      } catch (error) {
        errors.push(`Draft Sessions: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Migrate Player Pools
    if (data.playerPools && (data.playerPools as { pools?: unknown[] }).pools) {
      try {
        await this.migratePlayerPools(user.id, data.playerPools);
        migratedStores.push('player-pools');
      } catch (error) {
        errors.push(`Player Pools: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Migrate Custom Pools
    if (data.customPools && (data.customPools as { pools?: unknown[] }).pools) {
      try {
        await this.migrateCustomPools(user.id, data.customPools);
        migratedStores.push('custom-pools');
      } catch (error) {
        errors.push(`Custom Pools: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Mark as migrated if at least partially successful
    if (migratedStores.length > 0) {
      this.markAsMigrated(user.id);
    }

    return {
      success: errors.length === 0,
      migratedStores,
      errors,
    };
  },

  async migrateMyTeams(userId: string, data: unknown): Promise<void> {
    if (!supabase) throw new Error('Supabase not configured');

    const { teams } = data as { teams: Array<{
      id: string;
      name: string;
      notes: string;
      players: Array<{
        id: string;
        summonerName: string;
        tagLine: string;
        role: string;
        notes: string;
        region: string;
        isSub: boolean;
        championPool: unknown;
        championGroups: unknown;
      }>;
      championPool?: unknown;
      createdAt: number;
      updatedAt: number;
    }> };

    // Get user's max teams (respect tier limit)
    const { profile } = useAuthStore.getState();
    const maxTeams = profile?.maxTeams ?? 1;
    const teamsToMigrate = teams.slice(0, maxTeams);

    for (let i = 0; i < teamsToMigrate.length; i++) {
      const team = teamsToMigrate[i];

      // Insert team
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: teamError } = await (supabase.from('my_teams') as any).upsert({
        id: team.id,
        user_id: userId,
        name: team.name,
        notes: team.notes || '',
        champion_pool: team.championPool || [],
        sort_order: i,
        created_at: new Date(team.createdAt).toISOString(),
        updated_at: new Date(team.updatedAt).toISOString(),
      });

      if (teamError) throw teamError;

      // Insert players
      if (team.players && team.players.length > 0) {
        const players = team.players.map((player, index) => {
          // Convert legacy championPool to championGroups if needed
          let championGroups = player.championGroups || [];
          const championPool = player.championPool || [];
          if ((!championGroups || !Array.isArray(championGroups) || championGroups.length === 0) && Array.isArray(championPool) && championPool.length > 0) {
            const championIds = championPool.map((item: unknown) => {
              if (typeof item === 'string') return item;
              if (item && typeof item === 'object' && 'championId' in item) {
                return (item as { championId: string }).championId;
              }
              return null;
            }).filter((id: unknown): id is string => id !== null);
            if (championIds.length > 0) {
              championGroups = [{ id: `pool-${player.id}`, name: 'Pool', championIds }];
            }
          }

          return {
            id: player.id,
            team_id: team.id,
            summoner_name: player.summonerName,
            tag_line: player.tagLine || '',
            role: player.role,
            notes: player.notes || '',
            region: player.region || 'euw',
            is_sub: player.isSub || false,
            champion_groups: championGroups,
            sort_order: index,
          };
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: playersError } = await (supabase.from('players') as any).upsert(players);
        if (playersError) throw playersError;
      }
    }
  },

  async migrateEnemyTeams(userId: string, data: unknown): Promise<void> {
    if (!supabase) throw new Error('Supabase not configured');

    const { teams } = data as { teams: Array<{
      id: string;
      name: string;
      notes: string;
      players: Array<{
        id: string;
        summonerName: string;
        tagLine: string;
        role: string;
        notes: string;
        region: string;
        isSub: boolean;
        championPool: unknown;
        championGroups: unknown;
      }>;
      createdAt: number;
      updatedAt: number;
    }> };

    for (const team of teams) {
      // Insert enemy team
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: teamError } = await (supabase.from('enemy_teams') as any).upsert({
        id: team.id,
        user_id: userId,
        name: team.name,
        notes: team.notes || '',
        created_at: new Date(team.createdAt).toISOString(),
        updated_at: new Date(team.updatedAt).toISOString(),
      });

      if (teamError) throw teamError;

      // Insert enemy players
      if (team.players && team.players.length > 0) {
        const players = team.players.map((player, index) => {
          // Convert legacy championPool to championGroups if needed
          let championGroups = player.championGroups as { id: string; name: string; championIds: string[] }[] || [];
          const championPool = player.championPool as unknown[] || [];
          if ((!championGroups || championGroups.length === 0) && Array.isArray(championPool) && championPool.length > 0) {
            const championIds = championPool.map((item: unknown) => {
              if (typeof item === 'string') return item;
              if (item && typeof item === 'object' && 'championId' in item) {
                return (item as { championId: string }).championId;
              }
              return null;
            }).filter((id: unknown): id is string => id !== null);
            if (championIds.length > 0) {
              championGroups = [{ id: `pool-${player.id}`, name: 'Pool', championIds }];
            }
          }

          return {
            id: player.id,
            team_id: team.id,
            summoner_name: player.summonerName,
            tag_line: player.tagLine || '',
            role: player.role,
            notes: player.notes || '',
            region: player.region || 'euw',
            is_sub: player.isSub || false,
            champion_groups: championGroups,
            sort_order: index,
          };
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: playersError } = await (supabase.from('enemy_players') as any).upsert(players);
        if (playersError) throw playersError;
      }
    }
  },

  async migrateSettings(userId: string, data: unknown): Promise<void> {
    if (!supabase) throw new Error('Supabase not configured');

    const settings = data as {
      defaultRegion?: string;
      hasCompletedOnboarding?: boolean;
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('user_settings') as any).upsert({
      user_id: userId,
      default_region: settings.defaultRegion || 'euw',
      has_completed_onboarding: settings.hasCompletedOnboarding || false,
    });

    if (error) throw error;
  },

  async migrateDraftSessions(userId: string, data: unknown): Promise<void> {
    if (!supabase) throw new Error('Supabase not configured');

    const { sessions } = data as { sessions: Array<{
      id: string;
      name: string;
      enemyTeamId?: string | null;
      myTeamId?: string | null;
      contestedPicks?: string[];
      potentialBans?: string[];
      banGroups?: { id: string; name: string; championIds: string[] }[];
      priorityGroups?: { id: string; name: string; championIds: string[] }[];
      notes?: string;
      notepad?: unknown;
      createdAt: number;
      updatedAt: number;
    }> };

    const sessionsToInsert = sessions.map((session, index) => {
      // Convert legacy flat arrays to groups if groups don't exist
      const banGroups = session.banGroups?.length ? session.banGroups :
        (session.potentialBans?.length ? [{ id: `ban-${session.id}`, name: 'Bans', championIds: session.potentialBans }] : []);
      const priorityGroups = session.priorityGroups?.length ? session.priorityGroups :
        (session.contestedPicks?.length ? [{ id: `priority-${session.id}`, name: 'Priorities', championIds: session.contestedPicks }] : []);

      return {
        id: session.id,
        user_id: userId,
        name: session.name,
        enemy_team_id: session.enemyTeamId || null,
        my_team_id: session.myTeamId || null,
        ban_groups: banGroups,
        priority_groups: priorityGroups,
        notes: session.notes || '',
        notepad: session.notepad || [],
        sort_order: index,
        created_at: new Date(session.createdAt).toISOString(),
        updated_at: new Date(session.updatedAt).toISOString(),
      };
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('draft_sessions') as any).upsert(sessionsToInsert);
    if (error) throw error;
  },

  async migratePlayerPools(userId: string, data: unknown): Promise<void> {
    if (!supabase) throw new Error('Supabase not configured');

    const { pools } = data as { pools: Array<{
      id: string;
      summonerName: string;
      tagLine?: string;
      role: string;
      championGroups?: unknown;
      updatedAt: number;
    }> };

    const poolsToInsert = pools.map((pool) => ({
      id: pool.id,
      user_id: userId,
      summoner_name: pool.summonerName,
      tag_line: pool.tagLine || '',
      role: pool.role,
      champion_groups: pool.championGroups || [],
      updated_at: new Date(pool.updatedAt).toISOString(),
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('player_pools') as any).upsert(poolsToInsert);
    if (error) throw error;
  },

  async migrateCustomPools(userId: string, data: unknown): Promise<void> {
    if (!supabase) throw new Error('Supabase not configured');

    const { pools } = data as { pools: Array<{
      id: string;
      name: string;
      championGroups?: unknown;
      createdAt: number;
      updatedAt: number;
    }> };

    const poolsToInsert = pools.map((pool) => ({
      id: pool.id,
      user_id: userId,
      name: pool.name,
      champion_groups: pool.championGroups || [],
      created_at: new Date(pool.createdAt).toISOString(),
      updated_at: new Date(pool.updatedAt).toISOString(),
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('custom_pools') as any).upsert(poolsToInsert);
    if (error) throw error;
  },

  /**
   * Clear localStorage after successful migration
   */
  clearLocalStorage(): void {
    STORAGE_KEYS.forEach((key) => {
      localStorage.removeItem(key);
    });
  },

  /**
   * Get a summary of what would be migrated
   */
  getMigrationSummary(): { store: string; count: number }[] {
    const data = this.collectLocalData();
    const summary: { store: string; count: number }[] = [];

    if (data.myTeam && (data.myTeam as { teams?: unknown[] }).teams) {
      summary.push({ store: 'My Teams', count: ((data.myTeam as { teams: unknown[] }).teams).length });
    }

    if (data.enemyTeams && (data.enemyTeams as { teams?: unknown[] }).teams) {
      summary.push({ store: 'Enemy Teams', count: ((data.enemyTeams as { teams: unknown[] }).teams).length });
    }

    if (data.drafts && (data.drafts as { sessions?: unknown[] }).sessions) {
      summary.push({ store: 'Draft Sessions', count: ((data.drafts as { sessions: unknown[] }).sessions).length });
    }

    if (data.playerPools && (data.playerPools as { pools?: unknown[] }).pools) {
      summary.push({ store: 'Player Pools', count: ((data.playerPools as { pools: unknown[] }).pools).length });
    }

    if (data.customPools && (data.customPools as { pools?: unknown[] }).pools) {
      summary.push({ store: 'Custom Pools', count: ((data.customPools as { pools: unknown[] }).pools).length });
    }

    return summary;
  },
};
