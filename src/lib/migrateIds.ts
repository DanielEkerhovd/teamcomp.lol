/**
 * Migration utility to convert old timestamp-based IDs to UUIDs
 * This runs once on app load and updates localStorage data
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function isUUID(id: string): boolean {
  return UUID_REGEX.test(id);
}

// Map old IDs to new UUIDs (for maintaining references)
const idMap = new Map<string, string>();

function migrateId(oldId: string): string {
  if (isUUID(oldId)) return oldId;

  if (idMap.has(oldId)) {
    return idMap.get(oldId)!;
  }

  const newId = generateUUID();
  idMap.set(oldId, newId);
  return newId;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function migrateObject(obj: any): any {
  if (obj === null || obj === undefined) return obj;

  if (Array.isArray(obj)) {
    return obj.map(migrateObject);
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (key === 'id' && typeof value === 'string' && !isUUID(value)) {
        result[key] = migrateId(value);
      } else if (
        (key === 'teamId' || key === 'enemyTeamId' || key === 'myTeamId' ||
         key === 'selectedTeamId' || key === 'team_id' || key === 'player_slot_id') &&
        typeof value === 'string' &&
        value &&
        !isUUID(value)
      ) {
        result[key] = migrateId(value);
      } else {
        result[key] = migrateObject(value);
      }
    }
    return result;
  }

  return obj;
}

const STORAGE_KEYS = [
  'teamcomp-lol-my-team',       // Note: singular, not 'my-teams'
  'teamcomp-lol-enemy-teams',
  'teamcomp-lol-drafts',
  'teamcomp-lol-player-pools',
  'teamcomp-lol-custom-pools',
  'teamcomp-lol-champion-pool',
  'teamcomp-lol-draft-theory',
];

const MIGRATION_KEY = 'teamcomp-lol-uuid-migration-v2';

export function migrateLocalStorageIds(): boolean {
  // Check if migration already done
  if (localStorage.getItem(MIGRATION_KEY)) {
    return false;
  }

  let migrated = false;

  for (const key of STORAGE_KEYS) {
    const data = localStorage.getItem(key);
    if (!data) continue;

    try {
      const parsed = JSON.parse(data);
      const migratedData = migrateObject(parsed);

      // Check if anything changed
      const newJson = JSON.stringify(migratedData);
      if (newJson !== data) {
        localStorage.setItem(key, newJson);
        migrated = true;
        console.log(`Migrated IDs in ${key}`);
      }
    } catch (e) {
      console.error(`Failed to migrate ${key}:`, e);
    }
  }

  // Mark migration as complete
  localStorage.setItem(MIGRATION_KEY, new Date().toISOString());

  if (migrated) {
    console.log('ID migration complete. Please refresh the page.');
  }

  return migrated;
}
