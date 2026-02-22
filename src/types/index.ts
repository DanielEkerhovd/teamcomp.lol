export type Role = 'top' | 'jungle' | 'mid' | 'adc' | 'support';

export type Region =
  | 'euw' | 'eune' | 'na' | 'kr' | 'br'
  | 'lan' | 'las' | 'oce' | 'tr' | 'ru'
  | 'jp' | 'ph' | 'sg' | 'th' | 'tw' | 'vn';

export const DEFAULT_REGION: Region = 'euw';

export const REGIONS: { value: Region; label: string }[] = [
  { value: 'euw', label: 'EU West' },
  { value: 'eune', label: 'EU Nordic & East' },
  { value: 'na', label: 'North America' },
  { value: 'kr', label: 'Korea' },
  { value: 'br', label: 'Brazil' },
  { value: 'lan', label: 'Latin America North' },
  { value: 'las', label: 'Latin America South' },
  { value: 'oce', label: 'Oceania' },
  { value: 'tr', label: 'Turkey' },
  { value: 'ru', label: 'Russia' },
  { value: 'jp', label: 'Japan' },
  { value: 'ph', label: 'Philippines' },
  { value: 'sg', label: 'Singapore' },
  { value: 'th', label: 'Thailand' },
  { value: 'tw', label: 'Taiwan' },
  { value: 'vn', label: 'Vietnam' },
];

export const ROLES: { value: Role; label: string }[] = [
  { value: 'top', label: 'Top' },
  { value: 'jungle', label: 'Jungle' },
  { value: 'mid', label: 'Mid' },
  { value: 'adc', label: 'ADC' },
  { value: 'support', label: 'Support' },
];

export interface Player {
  id: string;
  summonerName: string;
  tagLine: string;
  role: Role;
  notes: string;
  region: Region;
  isSub?: boolean;
  championPool: TieredChampion[];
  championGroups?: ChampionGroup[];
}

// A champion pool tied to a specific player name + role.
// This persists across team changes: if a player moves from Top to Mid,
// their Top pool is preserved and restored when they return to Top.
export interface PlayerPool {
  id: string;
  summonerName: string; // stored as entered; lookups are case-insensitive
  tagLine: string;
  role: Role;           // the role this pool belongs to
  championGroups: ChampionGroup[];
  updatedAt: number;
}

export interface Team {
  id: string;
  name: string;
  players: Player[];
  notes: string;
  createdAt: number;
  updatedAt: number;
  championPool?: TeamChampionPriority[];
}

export interface Champion {
  id: string;
  name: string;
  key: string;
  tags: string[]; // Champion classes from Data Dragon (Fighter, Mage, Tank, etc.)
}

export type Priority = 'high' | 'medium' | 'low';

export type ChampionTier = 'S' | 'A' | 'B' | 'C';

export interface TieredChampion {
  championId: string;
  tier: ChampionTier;
}

export interface ChampionGroup {
  id: string;
  name: string;
  championIds: string[];
}

// A custom pool not tied to any player or team (e.g., tier lists)
export interface CustomPool {
  id: string;
  name: string;
  championGroups: ChampionGroup[];
  createdAt: number;
  updatedAt: number;
}

export interface TeamChampionPriority {
  championId: string;
  priority: Priority;
  notes?: string;
}

export const TIERS: { value: ChampionTier; label: string; color: string }[] = [
  { value: 'S', label: 'S Tier', color: 'text-yellow-400' },
  { value: 'A', label: 'A Tier', color: 'text-green-400' },
  { value: 'B', label: 'B Tier', color: 'text-blue-400' },
  { value: 'C', label: 'C Tier', color: 'text-gray-400' },
];

export interface ChampionPriority {
  championId: string;
  role: Role;
  priority: Priority;
  notes: string;
}

export interface DraftSession {
  id: string;
  name: string;
  enemyTeamId: string | null;
  contestedPicks: string[];
  potentialBans: string[];
  ourPriorities: ChampionPriority[];
  notes: string;
  createdAt: number;
  updatedAt: number;
}

// Helper function to generate unique IDs
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

// Helper function to create an empty player
export function createEmptyPlayer(role: Role): Player {
  return {
    id: generateId(),
    summonerName: '',
    tagLine: '',
    role,
    notes: '',
    region: DEFAULT_REGION,
    championPool: [],
    championGroups: [],
  };
}

// Helper function to create an empty team
export function createEmptyTeam(name: string = ''): Team {
  return {
    id: generateId(),
    name,
    players: ROLES.map(r => createEmptyPlayer(r.value)),
    notes: '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// Helper to create a sub player
export function createSubPlayer(region: Region = DEFAULT_REGION): Player {
  return {
    id: generateId(),
    summonerName: '',
    tagLine: '',
    role: 'mid', // default, can be changed
    notes: '',
    region,
    isSub: true,
    championPool: [],
    championGroups: [],
  };
}

// Parse OP.GG multi-search URL
export interface ParsedOpggResult {
  region: Region;
  players: { summonerName: string; tagLine: string }[];
}

export function parseOpggMultiSearchUrl(url: string): ParsedOpggResult | null {
  try {
    const urlObj = new URL(url);

    // Check if it's an OP.GG URL
    if (!urlObj.hostname.includes('op.gg')) {
      return null;
    }

    // Extract region from path: /multisearch/euw or /multisearch/na
    const pathMatch = urlObj.pathname.match(/\/multisearch\/([a-z]+)/i);
    if (!pathMatch) {
      return null;
    }

    const regionStr = pathMatch[1].toLowerCase();
    const validRegions: Region[] = ['euw', 'eune', 'na', 'kr', 'br', 'lan', 'las', 'oce', 'tr', 'ru', 'jp', 'ph', 'sg', 'th', 'tw', 'vn'];

    if (!validRegions.includes(regionStr as Region)) {
      return null;
    }

    const region = regionStr as Region;

    // Get summoners from query param
    const summonersParam = urlObj.searchParams.get('summoners');
    if (!summonersParam) {
      return null;
    }

    // Parse summoner names - they're comma-separated, with format "Name#Tag" or just "Name"
    const players = decodeURIComponent(summonersParam)
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0)
      .map(s => {
        // Check for # separator (Riot ID format)
        if (s.includes('#')) {
          const [name, tag] = s.split('#');
          return { summonerName: name.trim(), tagLine: tag.trim() };
        }
        // No tag provided
        return { summonerName: s.trim(), tagLine: '' };
      });

    return { region, players };
  } catch {
    return null;
  }
}
