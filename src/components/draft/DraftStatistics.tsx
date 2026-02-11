import { useMemo } from 'react';
import { Card } from '../ui';
import { ChampionIcon } from '../champion';
import { Team, Player, TIERS } from '../../types';
import { useChampionData } from '../../hooks/useChampionData';

interface DraftStatisticsProps {
  myTeam: Team;
  enemyTeam: Team | null;
}

interface ChampionStat {
  championId: string;
  count: number;
  bestTier: string;
  players: string[];
}

export default function DraftStatistics({ myTeam, enemyTeam }: DraftStatisticsProps) {
  const { getChampionById } = useChampionData();

  // Calculate enemy team ban suggestions
  const enemyBanSuggestions = useMemo(() => {
    if (!enemyTeam) return [];

    const champStats: Record<string, ChampionStat> = {};

    enemyTeam.players.forEach((player) => {
      if (!player.championPool) return;
      player.championPool.forEach((champ) => {
        if (!champStats[champ.championId]) {
          champStats[champ.championId] = {
            championId: champ.championId,
            count: 0,
            bestTier: champ.tier,
            players: [],
          };
        }
        champStats[champ.championId].count++;
        champStats[champ.championId].players.push(player.summonerName || player.role);

        // Track best tier (S > A > B > C)
        const tierOrder = ['S', 'A', 'B', 'C'];
        const currentBestIndex = tierOrder.indexOf(champStats[champ.championId].bestTier);
        const newTierIndex = tierOrder.indexOf(champ.tier);
        if (newTierIndex < currentBestIndex) {
          champStats[champ.championId].bestTier = champ.tier;
        }
      });
    });

    // Sort by tier (S first), then by count
    return Object.values(champStats)
      .sort((a, b) => {
        const tierOrder = ['S', 'A', 'B', 'C'];
        const tierDiff = tierOrder.indexOf(a.bestTier) - tierOrder.indexOf(b.bestTier);
        if (tierDiff !== 0) return tierDiff;
        return b.count - a.count;
      })
      .slice(0, 10);
  }, [enemyTeam]);

  // Calculate contested picks (champions both teams want)
  const contestedPicks = useMemo(() => {
    if (!enemyTeam) return [];

    const myChampions = new Set<string>();
    myTeam.players.forEach((player) => {
      player.championPool?.forEach((champ) => {
        myChampions.add(champ.championId);
      });
    });

    const contested: ChampionStat[] = [];
    const seen = new Set<string>();

    enemyTeam.players.forEach((player) => {
      player.championPool?.forEach((champ) => {
        if (myChampions.has(champ.championId) && !seen.has(champ.championId)) {
          seen.add(champ.championId);
          contested.push({
            championId: champ.championId,
            count: 1,
            bestTier: champ.tier,
            players: [player.summonerName || player.role],
          });
        }
      });
    });

    return contested.slice(0, 8);
  }, [myTeam, enemyTeam]);

  if (!enemyTeam) {
    return (
      <Card variant="bordered" className="text-center py-6">
        <p className="text-gray-500">Select an enemy team to see draft statistics</p>
      </Card>
    );
  }

  const getTierColor = (tier: string) => {
    return TIERS.find((t) => t.value === tier)?.color || 'text-gray-400';
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Ban Suggestions */}
      <Card variant="bordered">
        <h3 className="text-lg font-semibold text-red-400 mb-3">Ban Suggestions</h3>
        <p className="text-xs text-gray-500 mb-3">
          Based on enemy team's champion pools
        </p>
        {enemyBanSuggestions.length === 0 ? (
          <p className="text-gray-500 text-sm">No enemy champion data available</p>
        ) : (
          <div className="space-y-2">
            {enemyBanSuggestions.map((stat) => {
              const champion = getChampionById(stat.championId);
              return (
                <div
                  key={stat.championId}
                  className="flex items-center gap-3 p-2 bg-lol-dark rounded-lg"
                >
                  <ChampionIcon championId={stat.championId} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm">{champion?.name}</div>
                    <div className="text-xs text-gray-500 truncate">
                      {stat.players.join(', ')}
                    </div>
                  </div>
                  <div className={`text-sm font-medium ${getTierColor(stat.bestTier)}`}>
                    {stat.bestTier}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Contested Picks */}
      <Card variant="bordered">
        <h3 className="text-lg font-semibold text-yellow-400 mb-3">Contested Picks</h3>
        <p className="text-xs text-gray-500 mb-3">
          Champions both teams want
        </p>
        {contestedPicks.length === 0 ? (
          <p className="text-gray-500 text-sm">No overlapping champions found</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {contestedPicks.map((stat) => {
              const champion = getChampionById(stat.championId);
              return (
                <div
                  key={stat.championId}
                  className="flex items-center gap-2 p-2 bg-lol-dark rounded-lg"
                >
                  <ChampionIcon championId={stat.championId} size="sm" />
                  <span className="text-white text-sm">{champion?.name}</span>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
