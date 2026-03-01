import { Champion } from '../types';

const DDRAGON_BASE = 'https://ddragon.leagueoflegends.com';

// Cache for version and champion data
let cachedVersion: string | null = null;
let cachedChampions: Champion[] | null = null;

export async function getLatestVersion(): Promise<string> {
  if (cachedVersion) return cachedVersion;

  const response = await fetch(`${DDRAGON_BASE}/api/versions.json`);
  const versions: string[] = await response.json();
  cachedVersion = versions[0];
  return cachedVersion;
}

export async function getChampions(): Promise<Champion[]> {
  if (cachedChampions) return cachedChampions;

  const version = await getLatestVersion();
  const response = await fetch(
    `${DDRAGON_BASE}/cdn/${version}/data/en_US/champion.json`
  );
  const data = await response.json();

  cachedChampions = Object.values(data.data).map((champ: any) => ({
    id: champ.id,
    name: champ.name,
    key: champ.key,
    tags: champ.tags || [],
  }));

  // Sort alphabetically
  cachedChampions.sort((a, b) => a.name.localeCompare(b.name));

  return cachedChampions;
}

export async function getChampionIconUrl(championId: string): Promise<string> {
  const version = await getLatestVersion();
  return `${DDRAGON_BASE}/cdn/${version}/img/champion/${championId}.png`;
}

export function getChampionIconUrlSync(version: string, championId: string): string {
  return `${DDRAGON_BASE}/cdn/${version}/img/champion/${championId}.png`;
}

// Get a champion by ID from cache (returns null if cache not loaded)
export function getChampionById(championId: string): Champion | null {
  if (!cachedChampions) return null;
  return cachedChampions.find(c => c.id === championId) || null;
}

// Get champion icon URL using a default version (for sync usage)
const DEFAULT_VERSION = '14.1.1';
export function getChampionIconUrlDefault(championId: string): string {
  const version = cachedVersion || DEFAULT_VERSION;
  return `${DDRAGON_BASE}/cdn/${version}/img/champion/${championId}.png`;
}

export async function getChampionSplashUrl(championId: string, skinNum: number = 0): Promise<string> {
  return `${DDRAGON_BASE}/cdn/img/champion/splash/${championId}_${skinNum}.jpg`;
}

// Community Dragon centered splash art (used in live draft pick slots)
// Some champions have non-standard filenames (e.g. LeBlanc, Aurora), so we
// fetch skins.json once to get the exact splash paths for every champion.
const CDRAGON_BASE = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default';

// Map from champion numeric key -> full centered splash URL
let splashMap: Map<string, string> | null = null;
let splashMapPromise: Promise<void> | null = null;

export function loadSplashMap(): Promise<void> {
  if (splashMap) return Promise.resolve();
  if (splashMapPromise) return splashMapPromise;

  splashMapPromise = fetch(`${CDRAGON_BASE}/v1/skins.json`)
    .then((res) => res.json())
    .then((data: Record<string, { splashPath?: string }>) => {
      splashMap = new Map();
      for (const [skinId, skin] of Object.entries(data)) {
        // Base skins end in "000" (e.g. "7000" for LeBlanc key=7)
        if (!skinId.endsWith('000') || !skin.splashPath) continue;
        const champKey = skinId.slice(0, -3);
        // splashPath looks like "/lol-game-data/assets/ASSETS/Characters/..."
        // Strip the prefix and lowercase to build a working CDragon URL
        const path = skin.splashPath
          .replace(/^\/lol-game-data\/assets\//, '')
          .toLowerCase();
        splashMap.set(champKey, `${CDRAGON_BASE}/${path}`);
      }
    })
    .catch((err) => {
      console.warn('Failed to load CDragon skins.json, falling back to guessed URLs', err);
      splashMap = new Map(); // empty map → fallback will be used
    });

  return splashMapPromise;
}

function getFallbackSplashUrl(championId: string): string {
  const key = championId.toLowerCase();
  return `${CDRAGON_BASE}/assets/characters/${key}/skins/base/images/${key}_splash_centered_0.jpg`;
}

export function getCenteredSplashUrl(championId: string): string {
  if (splashMap) {
    const champ = cachedChampions?.find((c) => c.id === championId);
    if (champ) {
      const url = splashMap.get(champ.key);
      if (url) return url;
    }
  }
  return getFallbackSplashUrl(championId);
}

/**
 * Preload all champion centered splash images into the browser cache.
 * Fetches CDragon skins.json first to get correct URLs, then preloads in batches.
 */
export async function preloadAllSplashes(champions: Champion[]): Promise<void> {
  await loadSplashMap();

  const BATCH_SIZE = 10;
  const BATCH_DELAY_MS = 100;

  champions.forEach((champ, i) => {
    const delay = Math.floor(i / BATCH_SIZE) * BATCH_DELAY_MS;
    setTimeout(() => {
      const img = new Image();
      img.src = getCenteredSplashUrl(champ.id);
    }, delay);
  });
}

export function clearCache(): void {
  cachedVersion = null;
  cachedChampions = null;
}
