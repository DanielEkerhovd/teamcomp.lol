import { ChampionPatchChange, StatChange, SpellChange, SpellValueChange } from '../types';

const DDRAGON_BASE = 'https://ddragon.leagueoflegends.com';
const CDRAGON_BASE = 'https://raw.communitydragon.org';

const STAT_LABELS: Record<string, string> = {
  hp: 'Health',
  hpperlevel: 'Health / Level',
  mp: 'Mana',
  mpperlevel: 'Mana / Level',
  movespeed: 'Move Speed',
  armor: 'Armor',
  armorperlevel: 'Armor / Level',
  spellblock: 'Magic Resist',
  spellblockperlevel: 'Magic Resist / Level',
  attackrange: 'Attack Range',
  hpregen: 'HP Regen',
  hpregenperlevel: 'HP Regen / Level',
  mpregen: 'Mana Regen',
  mpregenperlevel: 'Mana Regen / Level',
  crit: 'Crit',
  critperlevel: 'Crit / Level',
  attackdamage: 'Attack Damage',
  attackdamageperlevel: 'AD / Level',
  attackspeedperlevel: 'Attack Speed / Level',
  attackspeed: 'Attack Speed',
};

const STAT_KEYS = Object.keys(STAT_LABELS);
const SPELL_KEYS = ['Q', 'W', 'E', 'R'];

// ── Caching ──────────────────────────────────────────────────────────

let cachedVersionList: string[] | null = null;

interface RawSpell {
  name: string;
  description: string;
  tooltip: string;
  cooldownBurn: string;
  costBurn: string;
  rangeBurn: string;
  effectBurn: (string | null)[];
  maxammo: string;
}

interface RawChampion {
  id: string;
  name: string;
  stats: Record<string, number>;
  passive: { name: string; description: string };
  spells: RawSpell[];
}

interface FullVersionData {
  champions: Map<string, RawChampion>;
}

const fullVersionCache = new Map<string, FullVersionData>();

// ── Version helpers ──────────────────────────────────────────────────

async function getVersionList(): Promise<string[]> {
  if (cachedVersionList) return cachedVersionList;
  const res = await fetch(`${DDRAGON_BASE}/api/versions.json`);
  cachedVersionList = await res.json();
  return cachedVersionList!;
}

export interface PatchVersion {
  patch: string;
  version: string;
}

export async function getPatchVersions(limit = 15): Promise<PatchVersion[]> {
  const versions = await getVersionList();
  const seen = new Map<string, string>();

  for (const v of versions) {
    const parts = v.split('.');
    if (parts.length < 2) continue;
    const patch = `${parts[0]}.${parts[1]}`;
    if (!seen.has(patch)) {
      seen.set(patch, v);
    }
  }

  return Array.from(seen.entries())
    .slice(0, limit)
    .map(([patch, version]) => ({ patch, version }));
}

// ── Full champion data per version (DDragon) ─────────────────────────

async function fetchFullVersionData(version: string): Promise<FullVersionData> {
  if (fullVersionCache.has(version)) return fullVersionCache.get(version)!;

  const res = await fetch(
    `${DDRAGON_BASE}/cdn/${version}/data/en_US/championFull.json`
  );
  const data = await res.json();

  const champions = new Map<string, RawChampion>();
  for (const champ of Object.values(data.data) as RawChampion[]) {
    champions.set(champ.id, champ);
  }

  const result = { champions };
  fullVersionCache.set(version, result);
  return result;
}

// ── CDragon .bin.json value extraction ───────────────────────────────

function toCDragonVersion(ddVersion: string): string {
  const parts = ddVersion.split('.');
  return `${parts[0]}.${parts[1]}`;
}

/**
 * Extracted gameplay values from a champion's .bin.json.
 * calculations: spell formula values (e.g. Calc_Damage_Monster_Flat_Bonus -> [125])
 * dataValues: named data value arrays (e.g. PassiveMonsterDamage -> [265, 0, ...])
 * effectAmounts: effect amount arrays (e.g. Effect1Amount -> [80, 120, ...])
 */
interface ExtractedValues {
  calculations: Record<string, number[]>;
  dataValues: Record<string, number[]>;
  effectAmounts: Record<string, number[]>;
}

// CDragon extracted values cache: version -> Map<championId, ExtractedValues>
const cdragonValuesCache = new Map<string, Map<string, ExtractedValues>>();

/** Recursively collect all mNumber values from nested objects */
function collectNumbers(obj: any): number[] {
  if (typeof obj !== 'object' || obj === null) return [];
  const nums: number[] = [];
  if (typeof obj.mNumber === 'number') nums.push(obj.mNumber);
  for (const v of Object.values(obj)) {
    if (typeof v === 'object' && v !== null) nums.push(...collectNumbers(v));
  }
  return nums;
}

/** Extract spell calculations, data values, and effect amounts from a .bin.json */
function extractValues(binJson: Record<string, unknown>): ExtractedValues {
  const calculations: Record<string, number[]> = {};
  const dataValues: Record<string, number[]> = {};
  const effectAmounts: Record<string, number[]> = {};

  function walk(obj: any) {
    if (typeof obj !== 'object' || obj === null) return;

    // Extract mSpellCalculations
    if (obj.mSpellCalculations && typeof obj.mSpellCalculations === 'object') {
      for (const [name, def] of Object.entries(obj.mSpellCalculations)) {
        const nums = collectNumbers(def);
        if (nums.length > 0) {
          calculations[name] = nums;
        }
      }
    }

    // Extract mDataValues
    if (Array.isArray(obj.mDataValues)) {
      for (const dv of obj.mDataValues as any[]) {
        if (dv?.mName && Array.isArray(dv.mValues)) {
          const nums = dv.mValues.filter((v: any) => typeof v === 'number');
          if (nums.length > 0) {
            dataValues[dv.mName] = nums;
          }
        }
      }
    }

    // Extract mEffectAmount entries (Effect1Amount, Effect2Amount, etc.)
    for (const [key, value] of Object.entries(obj)) {
      if (/^mEffectAmount$|^Effect\d+Amount$/i.test(key) && Array.isArray(value)) {
        const nums = (value as any[]).filter((v: any) => typeof v === 'number');
        if (nums.length > 0) {
          effectAmounts[key] = nums;
        }
      }
      // Extract mCoefficient values
      if (/^mCoefficient/i.test(key) && typeof value === 'number') {
        effectAmounts[key] = [value];
      }
    }

    // Recurse (skip already-processed keys)
    for (const [key, value] of Object.entries(obj)) {
      if (key === 'mSpellCalculations' || key === 'mDataValues') continue;
      if (typeof value === 'object' && value !== null) {
        walk(value);
      }
    }
  }

  walk(binJson);
  return { calculations, dataValues, effectAmounts };
}

/** Deterministic stringify for hashing (sorts keys at every level) */
function stableStringify(obj: any): string {
  if (obj === null || obj === undefined) return 'null';
  if (typeof obj === 'number' || typeof obj === 'boolean') return String(obj);
  if (typeof obj === 'string') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(stableStringify).join(',') + ']';
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}';
}

async function hashText(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Clean internal names: Calc_Damage_Monster_Flat_Bonus -> Monster Flat Bonus */
function cleanCalcName(name: string): string {
  return name
    .replace(/^Calc_?/i, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
}

/** Clean camelCase data names: PassiveMonsterDamage -> Passive Monster Damage */
function cleanDataName(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/^m\s*/i, '') // Strip leading "m" prefix
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
}

/** Format a number array as a readable string, trimming trailing zeros */
function formatNumArray(nums: number[]): string {
  let end = nums.length;
  while (end > 1 && nums[end - 1] === 0) end--;
  const trimmed = nums.slice(0, end);
  if (trimmed.length === 1) return trimmed[0].toString();
  return trimmed.join('/');
}

/** Diff two ExtractedValues and return SpellValueChange[] */
function diffExtractedValues(
  oldVals: ExtractedValues,
  newVals: ExtractedValues
): SpellValueChange[] {
  const changes: SpellValueChange[] = [];

  function diffRecords(
    oldRec: Record<string, number[]>,
    newRec: Record<string, number[]>,
    nameFormatter: (name: string) => string
  ) {
    const allNames = new Set([...Object.keys(oldRec), ...Object.keys(newRec)]);
    for (const name of allNames) {
      const oldNums = oldRec[name];
      const newNums = newRec[name];
      if (!oldNums || !newNums) continue;

      const oldStr = formatNumArray(oldNums);
      const newStr = formatNumArray(newNums);
      if (oldStr === newStr) continue;

      const avg = (ns: number[]) => ns.reduce((a, b) => a + b, 0) / ns.length;
      const dir = avg(newNums) > avg(oldNums) ? 'buff' as const
        : avg(newNums) < avg(oldNums) ? 'nerf' as const
        : 'changed' as const;

      changes.push({
        field: nameFormatter(name),
        oldValue: oldStr,
        newValue: newStr,
        direction: dir,
      });
    }
  }

  diffRecords(oldVals.calculations, newVals.calculations, cleanCalcName);
  diffRecords(oldVals.dataValues, newVals.dataValues, cleanDataName);
  diffRecords(oldVals.effectAmounts, newVals.effectAmounts, cleanDataName);

  return changes;
}

async function fetchCDragonValuesForVersion(
  version: string,
  championIds: string[],
  onProgress?: (done: number, total: number) => void
): Promise<Map<string, ExtractedValues>> {
  if (cdragonValuesCache.has(version)) return cdragonValuesCache.get(version)!;

  const cdVersion = toCDragonVersion(version);
  const values = new Map<string, ExtractedValues>();
  const CONCURRENCY = 15;
  let completed = 0;

  for (let i = 0; i < championIds.length; i += CONCURRENCY) {
    const batch = championIds.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(async (champId) => {
      const name = champId.toLowerCase();
      try {
        const res = await fetch(
          `${CDRAGON_BASE}/${cdVersion}/game/data/characters/${name}/${name}.bin.json`
        );
        if (res.ok) {
          const json = await res.json();
          values.set(champId, extractValues(json));
        }
      } catch {
        // Skip champions that fail to fetch
      }
      completed++;
      onProgress?.(completed, championIds.length);
    }));
  }

  cdragonValuesCache.set(version, values);
  return values;
}

/**
 * Get CDragon-detected changes for champions not already detected by DDragon.
 * Uses hash comparison for detection, then value diff for display.
 */
async function getCDragonChanges(
  currentVersion: string,
  previousVersion: string,
  championIds: string[],
  alreadyDetected: Set<string>,
  onProgress?: (done: number, total: number) => void
): Promise<Map<string, SpellValueChange[]>> {
  const uncheckedIds = championIds.filter(id => !alreadyDetected.has(id));
  if (uncheckedIds.length === 0) return new Map();

  const totalPerVersion = uncheckedIds.length;
  const totalCombined = totalPerVersion * 2;

  const [currentValues, previousValues] = await Promise.all([
    fetchCDragonValuesForVersion(currentVersion, uncheckedIds, (done) => {
      onProgress?.(done, totalCombined);
    }),
    fetchCDragonValuesForVersion(previousVersion, uncheckedIds, (done) => {
      onProgress?.(totalPerVersion + done, totalCombined);
    }),
  ]);

  const result = new Map<string, SpellValueChange[]>();

  for (const champId of uncheckedIds) {
    const curVals = currentValues.get(champId);
    const prevVals = previousValues.get(champId);
    if (!curVals || !prevVals) continue;

    // Quick hash check: skip detailed diff if extracted data is identical
    const curHash = await hashText(stableStringify(curVals));
    const prevHash = await hashText(stableStringify(prevVals));
    if (curHash === prevHash) continue;

    // Hash differs: find specific value changes
    const changes = diffExtractedValues(prevVals, curVals);
    if (changes.length > 0) {
      result.set(champId, changes);
    } else {
      // Hash differs but no specific diff found — still mark as changed
      result.set(champId, [{
        field: 'Ability Data',
        oldValue: 'Modified',
        newValue: 'Modified',
        direction: 'changed',
      }]);
    }
  }

  return result;
}

// ── Stat diffing ─────────────────────────────────────────────────────

function diffStats(
  oldStats: Record<string, number>,
  newStats: Record<string, number>
): StatChange[] {
  const changes: StatChange[] = [];

  for (const key of STAT_KEYS) {
    const oldVal = oldStats[key];
    const newVal = newStats[key];
    if (oldVal !== undefined && newVal !== undefined && oldVal !== newVal) {
      changes.push({
        stat: key,
        label: STAT_LABELS[key],
        oldValue: oldVal,
        newValue: newVal,
        direction: newVal > oldVal ? 'buff' : 'nerf',
      });
    }
  }

  return changes;
}

// ── DDragon ability diffing ──────────────────────────────────────────

function burnDirection(
  field: string,
  oldBurn: string,
  newBurn: string
): 'buff' | 'nerf' | 'changed' {
  const parse = (s: string) =>
    s.split('/').map(Number).filter((n) => !isNaN(n));

  const oldNums = parse(oldBurn);
  const newNums = parse(newBurn);

  if (oldNums.length === 0 || newNums.length === 0) return 'changed';

  const avg = (nums: number[]) => nums.reduce((a, b) => a + b, 0) / nums.length;
  const oldAvg = avg(oldNums);
  const newAvg = avg(newNums);

  if (oldAvg === newAvg) return 'changed';

  if (field === 'Cooldown' || field === 'Cost') {
    return newAvg < oldAvg ? 'buff' : 'nerf';
  }
  return newAvg > oldAvg ? 'buff' : 'nerf';
}

function diffSpell(
  spellKey: string,
  oldSpell: RawSpell,
  newSpell: RawSpell
): SpellChange | null {
  const changes: SpellValueChange[] = [];

  const fields: { key: keyof RawSpell; label: string }[] = [
    { key: 'cooldownBurn', label: 'Cooldown' },
    { key: 'costBurn', label: 'Cost' },
    { key: 'rangeBurn', label: 'Range' },
  ];

  for (const { key, label } of fields) {
    const oldVal = oldSpell[key] as string;
    const newVal = newSpell[key] as string;
    if (oldVal !== newVal) {
      changes.push({
        field: label,
        oldValue: oldVal,
        newValue: newVal,
        direction: burnDirection(label, oldVal, newVal),
      });
    }
  }

  if (oldSpell.maxammo !== newSpell.maxammo) {
    changes.push({
      field: 'Charges',
      oldValue: oldSpell.maxammo || '-',
      newValue: newSpell.maxammo || '-',
      direction: burnDirection('Effect', oldSpell.maxammo || '0', newSpell.maxammo || '0'),
    });
  }

  const oldEffects = oldSpell.effectBurn ?? [];
  const newEffects = newSpell.effectBurn ?? [];
  const maxLen = Math.max(oldEffects.length, newEffects.length);

  for (let i = 1; i < maxLen; i++) {
    const oldVal = oldEffects[i] ?? '';
    const newVal = newEffects[i] ?? '';
    if (oldVal && newVal && oldVal !== newVal) {
      changes.push({
        field: `Effect ${i}`,
        oldValue: oldVal,
        newValue: newVal,
        direction: burnDirection('Effect', oldVal, newVal),
      });
    }
  }

  // Tooltip/description comparison catches changes DDragon doesn't expose in structured fields
  if (changes.length === 0) {
    if (oldSpell.tooltip !== newSpell.tooltip || oldSpell.description !== newSpell.description) {
      changes.push({
        field: 'Values',
        oldValue: 'Modified',
        newValue: 'Modified',
        direction: 'changed',
      });
    }
  }

  if (oldSpell.name !== newSpell.name) {
    changes.unshift({
      field: 'Name',
      oldValue: oldSpell.name,
      newValue: newSpell.name,
      direction: 'changed',
    });
  }

  if (changes.length === 0) return null;

  return {
    spellKey,
    spellName: newSpell.name,
    changes,
  };
}

function diffChampionAbilities(
  oldChamp: RawChampion,
  newChamp: RawChampion
): SpellChange[] {
  const spellChanges: SpellChange[] = [];

  // Compare passive
  const passiveChanges: SpellValueChange[] = [];
  if (newChamp.passive.name !== oldChamp.passive.name) {
    passiveChanges.push({
      field: 'Name',
      oldValue: oldChamp.passive.name,
      newValue: newChamp.passive.name,
      direction: 'changed',
    });
  }
  if (newChamp.passive.description !== oldChamp.passive.description && passiveChanges.length === 0) {
    passiveChanges.push({
      field: 'Values',
      oldValue: 'Modified',
      newValue: 'Modified',
      direction: 'changed',
    });
  }
  if (passiveChanges.length > 0) {
    spellChanges.push({
      spellKey: 'Passive',
      spellName: newChamp.passive.name,
      changes: passiveChanges,
    });
  }

  // Compare Q/W/E/R
  for (let i = 0; i < 4; i++) {
    const oldSpell = oldChamp.spells[i];
    const newSpell = newChamp.spells[i];
    if (!oldSpell || !newSpell) continue;

    const change = diffSpell(SPELL_KEYS[i], oldSpell, newSpell);
    if (change) spellChanges.push(change);
  }

  return spellChanges;
}

// ── Main comparison ──────────────────────────────────────────────────

export interface CompareProgress {
  phase: 'ddragon' | 'cdragon';
  done: number;
  total: number;
}

/**
 * Compare all champion data between two versions.
 * Phase 1: DDragon comparison (fast, structured diffs + tooltip detection)
 * Phase 2: CDragon .bin.json value extraction (catches everything DDragon misses)
 */
export async function comparePatch(
  currentVersion: string,
  previousVersion: string,
  onProgress?: (progress: CompareProgress) => void
): Promise<ChampionPatchChange[]> {
  // Phase 1: DDragon comparison
  onProgress?.({ phase: 'ddragon', done: 0, total: 1 });

  const [current, previous] = await Promise.all([
    fetchFullVersionData(currentVersion),
    fetchFullVersionData(previousVersion),
  ]);

  const results: ChampionPatchChange[] = [];
  const detectedIds = new Set<string>();

  for (const [champId, newChamp] of current.champions) {
    const oldChamp = previous.champions.get(champId);

    if (!oldChamp) {
      results.push({
        championId: champId,
        championName: newChamp.name,
        isNew: true,
        changes: [],
        spellChanges: [],
      });
      detectedIds.add(champId);
      continue;
    }

    const statChanges = diffStats(oldChamp.stats, newChamp.stats);
    const spellChanges = diffChampionAbilities(oldChamp, newChamp);

    if (statChanges.length > 0 || spellChanges.length > 0) {
      results.push({
        championId: champId,
        championName: newChamp.name,
        isNew: false,
        changes: statChanges,
        spellChanges,
      });
      detectedIds.add(champId);
    }
  }

  onProgress?.({ phase: 'ddragon', done: 1, total: 1 });

  // Phase 2: CDragon value extraction for champions DDragon missed
  const allChampionIds = Array.from(current.champions.keys());

  const cdragonChanges = await getCDragonChanges(
    currentVersion,
    previousVersion,
    allChampionIds,
    detectedIds,
    (done, total) => onProgress?.({ phase: 'cdragon', done, total })
  );

  // Add CDragon-detected champions with actual value diffs
  for (const [champId, valueChanges] of cdragonChanges) {
    const champ = current.champions.get(champId);
    if (!champ) continue;

    results.push({
      championId: champId,
      championName: champ.name,
      isNew: false,
      changes: [],
      spellChanges: [{
        spellKey: 'Abilities',
        spellName: '',
        changes: valueChanges,
      }],
    });
  }

  // Sort: new champions first, then alphabetical
  results.sort((a, b) => {
    if (a.isNew !== b.isNew) return a.isNew ? -1 : 1;
    return a.championName.localeCompare(b.championName);
  });

  return results;
}
