import { useMemo } from 'react';
import { Team, Player, CustomPool, ChampionTier, Role, ChampionGroup, PlayerPool } from '../../../types';

// Source types for flexible pool selection
export type PoolSource =
  | { type: 'team'; team: Team; side: 'my' | 'enemy' }
  | { type: 'custom'; pool: CustomPool; side: 'my' | 'enemy' }
  | { type: 'player'; player: Player; side: 'my' | 'enemy' };

// Champion appearance context
export interface ChampionContext {
  championId: string;
  source: string; // Player name, custom pool name, or team name
  sourceType: 'player' | 'custom' | 'team';
  side: 'my' | 'enemy';
  role?: Role;
  tier?: ChampionTier;
  tierKnown: boolean; // true if tier came from championPool, false if inferred/default
  groupName?: string;
}

// Ban candidate with scoring
export interface BanCandidate {
  championId: string;
  score: number;
  bestTier: ChampionTier | null; // null = no tier data (common for enemies)
  playerCount: number;
  players: { name: string; role: Role; tier: ChampionTier | null }[];
  isFlexPick: boolean;
  isContested: boolean;
}

// Contested champion with full context
export interface ContestedChampion {
  championId: string;
  myContext: ChampionContext[];
  enemyContext: ChampionContext[];
}

// Flex pick (champion played by multiple players on same team)
export interface FlexPick {
  championId: string;
  players: { name: string; role: Role; tier: ChampionTier | null }[];
  bestTier: ChampionTier | null;
}

// Group info for filtering
export interface GroupInfo {
  id: string;
  name: string;
  source: string;
  side: 'my' | 'enemy';
}

export interface DraftAnalytics {
  // All champions from all sources with context
  allChampions: Map<string, ChampionContext[]>;

  // Contested picks (appears on both sides)
  contested: ContestedChampion[];

  // Enemy ban candidates ranked by priority
  banCandidates: BanCandidate[];

  // Flex picks per side
  myFlexPicks: FlexPick[];
  enemyFlexPicks: FlexPick[];

  // Available groups for filtering
  availableGroups: GroupInfo[];

  // My team's champion set (for quick lookup)
  myChampionSet: Set<string>;

  // Enemy team's champion set
  enemyChampionSet: Set<string>;
}

interface UseDraftAnalyticsProps {
  myTeam: Team | null;
  enemyTeam: Team | null;
  customPools: CustomPool[];
  selectedCustomPoolIds: string[];
  tierFilter: ChampionTier[];
  // Player pools from usePlayerPoolStore - these contain the actual champion groups
  playerPools: PlayerPool[];
}

// Helper to find player pool by summoner name + role
function findPlayerPool(pools: PlayerPool[], summonerName: string, role: Role): PlayerPool | null {
  const normalized = summonerName.toLowerCase().trim();
  return pools.find(
    (p) => p.summonerName.toLowerCase().trim() === normalized && p.role === role
  ) ?? null;
}

const TIER_SCORE: Record<ChampionTier, number> = {
  S: 100,
  A: 75,
  B: 50,
  C: 25,
};

function getTierFromGroups(groups: ChampionGroup[], championId: string): ChampionTier | undefined {
  for (const group of groups) {
    if (group.championIds.includes(championId)) {
      const tierMatch = group.name.match(/^([SABC])[-\s]?[Tt]ier$/i);
      if (tierMatch) {
        return tierMatch[1].toUpperCase() as ChampionTier;
      }
    }
  }
  return undefined;
}

function getGroupName(groups: ChampionGroup[], championId: string): string | undefined {
  const group = groups.find(g => g.championIds.includes(championId));
  return group?.name;
}

export function useDraftAnalytics({
  myTeam,
  enemyTeam,
  customPools,
  selectedCustomPoolIds,
  tierFilter,
  playerPools,
}: UseDraftAnalyticsProps): DraftAnalytics {
  return useMemo(() => {
    const allChampions = new Map<string, ChampionContext[]>();
    const myChampionSet = new Set<string>();
    const enemyChampionSet = new Set<string>();
    const availableGroups: GroupInfo[] = [];

    // Helper to add champion context
    const addChampionContext = (context: ChampionContext) => {
      // Apply tier filter
      if (context.tier && !tierFilter.includes(context.tier)) {
        return;
      }

      const existing = allChampions.get(context.championId) || [];
      existing.push(context);
      allChampions.set(context.championId, existing);

      if (context.side === 'my') {
        myChampionSet.add(context.championId);
      } else {
        enemyChampionSet.add(context.championId);
      }
    };

    // Helper to process a player's data
    const processPlayer = (player: Player, side: 'my' | 'enemy') => {
      if (!player.summonerName) return;

      // Track which champions have been added for this player (to avoid duplicates)
      const addedChampions = new Set<string>();

      // Get the player's pool from the store (this has the actual champion groups)
      const playerPool = findPlayerPool(playerPools, player.summonerName, player.role);
      const groups = playerPool?.championGroups || player.championGroups || [];

      // Build tier lookup from player.championPool FIRST (this has the actual tier data)
      const tierLookup = new Map<string, ChampionTier>();
      player.championPool?.forEach((champ) => {
        tierLookup.set(champ.championId, champ.tier);
      });

      // Add groups to available groups
      groups.forEach((group) => {
        availableGroups.push({
          id: group.id,
          name: group.name,
          source: player.summonerName,
          side,
        });

        // Process champions in this group
        // Use tier from: 1) tierLookup (player.championPool), 2) group name pattern
        group.championIds.forEach((championId) => {
          // Skip if already added for this player
          if (addedChampions.has(championId)) return;
          addedChampions.add(championId);

          const knownTier = tierLookup.get(championId);
          const inferredTier = getTierFromGroups(groups, championId);
          const tier = knownTier || inferredTier;
          addChampionContext({
            championId,
            source: player.summonerName,
            sourceType: 'player',
            side,
            role: player.role,
            tier,
            tierKnown: knownTier !== undefined,
            groupName: group.name,
          });
        });
      });

      // Also process tiered champion pool from the player object (for backwards compatibility)
      // This catches any champions in championPool that aren't in any group
      // Only use legacy data when there's no pool in the dedicated store (avoids stale data)
      if (!playerPool) player.championPool?.forEach((champ) => {
        // Skip if already added from groups
        if (addedChampions.has(champ.championId)) return;
        addedChampions.add(champ.championId);

        addChampionContext({
          championId: champ.championId,
          source: player.summonerName,
          sourceType: 'player',
          side,
          role: player.role,
          tier: champ.tier,
          tierKnown: true, // From championPool, so tier is known
          groupName: getGroupName(groups, champ.championId),
        });
      });
    };

    // Process my team players
    if (myTeam) {
      myTeam.players.forEach((player) => {
        processPlayer(player, 'my');
      });
    }

    // Process enemy team players
    if (enemyTeam) {
      enemyTeam.players.forEach((player) => {
        processPlayer(player, 'enemy');
      });
    }

    // Process selected custom pools (count as "my" side for contested detection)
    const selectedPools = customPools.filter((p) => selectedCustomPoolIds.includes(p.id));
    selectedPools.forEach((pool) => {
      // Track which champions have been added for this pool (to avoid duplicates)
      const addedChampions = new Set<string>();

      // Add groups to available groups
      pool.championGroups.forEach((group) => {
        availableGroups.push({
          id: group.id,
          name: group.name,
          source: pool.name,
          side: 'my',
        });

        group.championIds.forEach((championId) => {
          // Skip if already added for this pool
          if (addedChampions.has(championId)) return;
          addedChampions.add(championId);

          const inferredTier = getTierFromGroups(pool.championGroups, championId);
          addChampionContext({
            championId,
            source: pool.name,
            sourceType: 'custom',
            side: 'my',
            tier: inferredTier,
            tierKnown: inferredTier !== undefined, // Known if group name indicates tier
            groupName: group.name,
          });
        });
      });
    });

    // Calculate contested picks
    const contested: ContestedChampion[] = [];
    allChampions.forEach((contexts, championId) => {
      const myContexts = contexts.filter((c) => c.side === 'my');
      const enemyContexts = contexts.filter((c) => c.side === 'enemy');

      if (myContexts.length > 0 && enemyContexts.length > 0) {
        contested.push({
          championId,
          myContext: myContexts,
          enemyContext: enemyContexts,
        });
      }
    });

    // Sort contested by enemy tier (best first)
    contested.sort((a, b) => {
      const aTier = a.enemyContext.reduce((best, c) => {
        if (!c.tier) return best;
        return TIER_SCORE[c.tier] > TIER_SCORE[best] ? c.tier : best;
      }, 'C' as ChampionTier);
      const bTier = b.enemyContext.reduce((best, c) => {
        if (!c.tier) return best;
        return TIER_SCORE[c.tier] > TIER_SCORE[best] ? c.tier : best;
      }, 'C' as ChampionTier);
      return TIER_SCORE[bTier] - TIER_SCORE[aTier];
    });

    // Calculate ban candidates (enemy champions ranked)
    const banCandidateMap = new Map<string, BanCandidate>();

    allChampions.forEach((contexts, championId) => {
      const enemyContexts = contexts.filter((c) => c.side === 'enemy' && c.sourceType === 'player');
      if (enemyContexts.length === 0) return;

      // Check if any context has known tier data
      const hasKnownTier = enemyContexts.some((c) => c.tierKnown);

      const players = enemyContexts.map((c) => ({
        name: c.source,
        role: c.role!,
        tier: c.tierKnown ? (c.tier || null) : null, // Only use tier if known
      }));

      // Only calculate bestTier if we have known tier data
      let bestTier: ChampionTier | null = null;
      if (hasKnownTier) {
        const knownTiers = players.filter((p) => p.tier !== null).map((p) => p.tier!);
        if (knownTiers.length > 0) {
          bestTier = knownTiers.reduce((best, tier) => {
            return TIER_SCORE[tier] > TIER_SCORE[best] ? tier : best;
          }, knownTiers[0]);
        }
      }

      const isFlexPick = new Set(players.map((p) => p.role)).size > 1;
      const isContested = myChampionSet.has(championId);

      // Score calculation: prioritize player count and flex for enemies without tier data
      // Base score: use tier if known, otherwise use neutral score (between A and B)
      let score = bestTier ? TIER_SCORE[bestTier] : 60;
      score += players.length * 25; // Multiple players is primary indicator for enemies
      if (isFlexPick) score += 20; // Flex picks are very valuable to ban
      if (isContested) score += 15; // Contested picks worth banning

      banCandidateMap.set(championId, {
        championId,
        score,
        bestTier,
        playerCount: players.length,
        players,
        isFlexPick,
        isContested,
      });
    });

    const banCandidates = Array.from(banCandidateMap.values()).sort((a, b) => b.score - a.score);

    // Calculate flex picks for each side
    const calculateFlexPicks = (side: 'my' | 'enemy'): FlexPick[] => {
      const flexMap = new Map<string, FlexPick>();

      allChampions.forEach((contexts, championId) => {
        const sideContexts = contexts.filter(
          (c) => c.side === side && c.sourceType === 'player' && c.role
        );

        // Need at least 2 different roles
        const roles = new Set(sideContexts.map((c) => c.role));
        if (roles.size < 2) return;

        const players = sideContexts.map((c) => ({
          name: c.source,
          role: c.role!,
          tier: c.tierKnown ? (c.tier || null) : null,
        }));

        // Calculate best tier only from known tiers
        const knownTiers = players.filter((p) => p.tier !== null).map((p) => p.tier!);
        const bestTier = knownTiers.length > 0
          ? knownTiers.reduce((best, tier) => TIER_SCORE[tier] > TIER_SCORE[best] ? tier : best, knownTiers[0])
          : null;

        flexMap.set(championId, { championId, players, bestTier });
      });

      // Sort by bestTier if available, otherwise by player count
      return Array.from(flexMap.values()).sort((a, b) => {
        const aScore = a.bestTier ? TIER_SCORE[a.bestTier] : 60;
        const bScore = b.bestTier ? TIER_SCORE[b.bestTier] : 60;
        return bScore - aScore;
      });
    };

    const myFlexPicks = calculateFlexPicks('my');
    const enemyFlexPicks = calculateFlexPicks('enemy');

    return {
      allChampions,
      contested,
      banCandidates,
      myFlexPicks,
      enemyFlexPicks,
      availableGroups,
      myChampionSet,
      enemyChampionSet,
    };
  }, [myTeam, enemyTeam, customPools, selectedCustomPoolIds, tierFilter, playerPools]);
}
