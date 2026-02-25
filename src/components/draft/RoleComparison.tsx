import { useMemo } from 'react';
import { Card } from '../ui';
import { ChampionIcon } from '../champion';
import { Team, Player, ChampionTier, Role, ROLES } from '../../types';
import { useChampionData } from '../../hooks/useChampionData';
import { usePlayerPoolStore } from '../../stores/usePlayerPoolStore';

interface RoleComparisonProps {
  myTeam: Team | null;
  enemyTeam: Team | null;
  contestedChampions: Set<string>;
  tierFilter: ChampionTier[];
  onAddBan: (championId: string) => void;
  onAddPriority: (championId: string) => void;
}

function usePlayerChampions(player: Player | undefined, tierFilter: ChampionTier[]) {
  // Get pools directly to ensure reactivity
  const pools = usePlayerPoolStore((state) => state.pools);

  return useMemo(() => {
    if (!player) return [];

    // Find pool by normalized name and role
    const normalizedName = player.summonerName?.toLowerCase().trim() || '';
    const pool = normalizedName
      ? pools.find(
          (p) => (p.summonerName?.toLowerCase().trim() || '') === normalizedName && p.role === player.role
        )
      : undefined;
    const groups = pool?.championGroups || player.championGroups || [];

    // Build tier lookup
    const tierLookup = new Map<string, ChampionTier>();
    player.championPool?.forEach((champ) => {
      tierLookup.set(champ.championId, champ.tier);
    });

    // Collect all champion IDs
    const allChampionIds = new Set<string>();
    groups.forEach((g) => g.championIds.forEach((id) => allChampionIds.add(id)));
    player.championPool?.forEach((c) => allChampionIds.add(c.championId));

    // Filter by tier if tier data exists
    const hasTierData = (player.championPool?.length ?? 0) > 0;
    if (hasTierData) {
      return Array.from(allChampionIds).filter((id) => {
        const tier = tierLookup.get(id);
        return tier && tierFilter.includes(tier);
      });
    }

    return Array.from(allChampionIds);
  }, [player, tierFilter, pools]);
}

function ChampionRow({
  championIds,
  contestedChampions,
  onChampionClick,
  side,
  maxShow = 8,
}: {
  championIds: string[];
  contestedChampions: Set<string>;
  onChampionClick: (id: string) => void;
  side: 'my' | 'enemy';
  maxShow?: number;
}) {
  const { getChampionById } = useChampionData();

  if (championIds.length === 0) {
    return <span className="text-gray-600 text-xs italic">No champions</span>;
  }

  const displayed = championIds.slice(0, maxShow);
  const remaining = championIds.length - maxShow;

  return (
    <div className={`flex gap-1 items-center ${side === 'enemy' ? 'flex-row-reverse' : ''}`}>
      {displayed.map((championId) => {
        const isContested = contestedChampions.has(championId);
        return (
          <div
            key={championId}
            className={`relative cursor-pointer transition-all hover:scale-110 ${
              isContested ? 'ring-2 ring-yellow-500 rounded' : ''
            }`}
            onClick={() => onChampionClick(championId)}
            title={`${getChampionById(championId)?.name}${isContested ? ' (Contested)' : ''}`}
          >
            <ChampionIcon championId={championId} size="sm" />
            {isContested && (
              <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-yellow-500 rounded-full" />
            )}
          </div>
        );
      })}
      {remaining > 0 && (
        <span className="text-[10px] text-gray-500 px-1">+{remaining}</span>
      )}
    </div>
  );
}

function RoleRow({
  role,
  myPlayer,
  enemyPlayer,
  contestedChampions,
  tierFilter,
  onAddBan,
  onAddPriority,
}: {
  role: Role;
  myPlayer: Player | undefined;
  enemyPlayer: Player | undefined;
  contestedChampions: Set<string>;
  tierFilter: ChampionTier[];
  onAddBan: (championId: string) => void;
  onAddPriority: (championId: string) => void;
}) {
  const roleInfo = ROLES.find((r) => r.value === role);
  const myChampions = usePlayerChampions(myPlayer, tierFilter);
  const enemyChampions = usePlayerChampions(enemyPlayer, tierFilter);

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center py-3 border-b border-lol-border/50 last:border-b-0">
      {/* My Team Side */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 truncate">
            {myPlayer?.summonerName || '—'}
          </span>
        </div>
        <ChampionRow
          championIds={myChampions}
          contestedChampions={contestedChampions}
          onChampionClick={onAddPriority}
          side="my"
        />
      </div>

      {/* Role Badge */}
      <div className="flex flex-col items-center gap-0.5">
        <div className="w-10 h-10 rounded-lg bg-lol-dark flex items-center justify-center">
          <span className="text-white font-bold text-xs">
            {roleInfo?.label.slice(0, 3).toUpperCase()}
          </span>
        </div>
      </div>

      {/* Enemy Team Side */}
      <div className="flex flex-col gap-1 items-end">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 truncate">
            {enemyPlayer?.summonerName || '—'}
          </span>
        </div>
        <ChampionRow
          championIds={enemyChampions}
          contestedChampions={contestedChampions}
          onChampionClick={onAddBan}
          side="enemy"
        />
      </div>
    </div>
  );
}

export default function RoleComparison({
  myTeam,
  enemyTeam,
  contestedChampions,
  tierFilter,
  onAddBan,
  onAddPriority,
}: RoleComparisonProps) {
  const mainRoles: Role[] = ['top', 'jungle', 'mid', 'adc', 'support'];

  const getPlayerByRole = (team: Team | null, role: Role) => {
    return team?.players.find((p) => p.role === role && !p.isSub);
  };

  if (!myTeam && !enemyTeam) {
    return (
      <Card variant="bordered" className="text-center py-8">
        <p className="text-gray-500">Select a team to view role comparison</p>
      </Card>
    );
  }

  return (
    <Card variant="bordered" padding="md">
      {/* Header */}
      <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center pb-3 mb-2 border-b border-lol-border">
        <div className="text-blue-400 text-xs font-medium uppercase tracking-wide">
          My Team
        </div>
        <div className="text-gray-600 text-xs font-medium uppercase tracking-wide text-center">
          Role
        </div>
        <div className="text-red-400 text-xs font-medium uppercase tracking-wide text-right">
          Enemy
        </div>
      </div>

      {/* Role Rows */}
      <div>
        {mainRoles.map((role) => (
          <RoleRow
            key={role}
            role={role}
            myPlayer={getPlayerByRole(myTeam, role)}
            enemyPlayer={getPlayerByRole(enemyTeam, role)}
            contestedChampions={contestedChampions}
            tierFilter={tierFilter}
            onAddBan={onAddBan}
            onAddPriority={onAddPriority}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-4 pt-3 border-t border-lol-border/50 text-[10px] text-gray-500">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-yellow-500 rounded-full" />
          <span>Contested</span>
        </div>
        <span>Click champion to add to priority/ban</span>
      </div>
    </Card>
  );
}
