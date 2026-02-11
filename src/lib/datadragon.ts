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

export async function getChampionSplashUrl(championId: string, skinNum: number = 0): Promise<string> {
  return `${DDRAGON_BASE}/cdn/img/champion/splash/${championId}_${skinNum}.jpg`;
}

export function clearCache(): void {
  cachedVersion = null;
  cachedChampions = null;
}
