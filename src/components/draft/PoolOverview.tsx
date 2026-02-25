import { Card } from '../ui';
import { ChampionIcon } from '../champion';
import { Team, CustomPool, Player, ChampionTier, ROLES, Role, ChampionGroup } from '../../types';
import { usePlayerPoolStore } from '../../stores/usePlayerPoolStore';

interface PoolOverviewProps {
  myTeam: Team | null;
  enemyTeam: Team | null;
  customPools: CustomPool[];
  contestedChampions: Set<string>;
  tierFilter: ChampionTier[];
  onAddBan: (championId: string) => void;
  onAddPriority: (championId: string) => void;
}

function ChampionGroupDisplay({
  group,
  contestedChampions,
  onChampionClick,
}: {
  group: ChampionGroup;
  contestedChampions: Set<string>;
  onChampionClick: (championId: string) => void;
}) {
  if (group.championIds.length === 0) return null;

  return (
    <div className="mb-2 last:mb-0">
      <div className="text-xs text-gray-500 mb-1">{group.name}</div>
      <div className="flex flex-wrap gap-1">
        {group.championIds.map((championId) => {
          const isContested = contestedChampions.has(championId);
          return (
            <div
              key={championId}
              className={`relative cursor-pointer transition-all hover:scale-110 ${
                isContested ? 'ring-2 ring-yellow-500 rounded' : ''
              }`}
              onClick={() => onChampionClick(championId)}
            >
              <ChampionIcon championId={championId} size="sm" />
              {isContested && (
                <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-yellow-500 rounded-full" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PlayerGroupsCard({
  player,
  contestedChampions,
  onChampionClick,
  side,
}: {
  player: Player;
  contestedChampions: Set<string>;
  onChampionClick: (championId: string) => void;
  side: 'my' | 'enemy';
}) {
  // Get pools directly to ensure reactivity
  const pools = usePlayerPoolStore((state) => state.pools);
  const roleInfo = ROLES.find((r) => r.value === player.role);

  // Get champion groups from player pool store or player data
  const normalizedName = player.summonerName?.toLowerCase().trim() || '';
  const pool = normalizedName
    ? pools.find(
        (p) => (p.summonerName?.toLowerCase().trim() || '') === normalizedName && p.role === player.role
      )
    : undefined;
  const groups = pool?.championGroups || player.championGroups || [];

  const totalChampions = groups.reduce((sum, g) => sum + g.championIds.length, 0);

  return (
    <div className="p-3 bg-lol-dark rounded-lg">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
          side === 'my' ? 'bg-blue-500/20 text-blue-400' : 'bg-red-500/20 text-red-400'
        }`}>
          {roleInfo?.label.slice(0, 3) || player.role.slice(0, 3).toUpperCase()}
        </div>
        <span className="text-white text-sm font-medium truncate">
          {player.summonerName || 'Unknown'}
        </span>
        <span className="text-xs text-gray-500 ml-auto">
          {totalChampions} champs
        </span>
      </div>

      {groups.length === 0 ? (
        <p className="text-gray-600 text-xs italic">No groups defined</p>
      ) : (
        <div>
          {groups.map((group) => (
            <ChampionGroupDisplay
              key={group.id}
              group={group}
              contestedChampions={contestedChampions}
              onChampionClick={onChampionClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TeamPoolSection({
  team,
  contestedChampions,
  onChampionClick,
  side,
}: {
  team: Team;
  contestedChampions: Set<string>;
  onChampionClick: (championId: string) => void;
  side: 'my' | 'enemy';
}) {
  const mainRoles: Role[] = ['top', 'jungle', 'mid', 'adc', 'support'];
  const players = mainRoles
    .map((role) => team.players.find((p) => p.role === role && !p.isSub))
    .filter(Boolean) as Player[];

  return (
    <Card variant="bordered" padding="md">
      <h3 className={`text-sm font-semibold mb-3 ${side === 'my' ? 'text-blue-400' : 'text-red-400'}`}>
        {team.name}
      </h3>
      <div className="space-y-2">
        {players.map((player) => (
          <PlayerGroupsCard
            key={player.id}
            player={player}
            contestedChampions={contestedChampions}
            onChampionClick={onChampionClick}
            side={side}
          />
        ))}
      </div>
    </Card>
  );
}

function CustomPoolSection({
  pool,
  contestedChampions,
  onChampionClick,
}: {
  pool: CustomPool;
  contestedChampions: Set<string>;
  onChampionClick: (championId: string) => void;
}) {
  return (
    <Card variant="bordered" padding="md">
      <h4 className="text-sm font-semibold text-purple-400 mb-3">{pool.name}</h4>
      {pool.championGroups.length === 0 ? (
        <p className="text-gray-500 text-sm">No groups</p>
      ) : (
        <div>
          {pool.championGroups.map((group) => (
            <ChampionGroupDisplay
              key={group.id}
              group={group}
              contestedChampions={contestedChampions}
              onChampionClick={onChampionClick}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

export default function PoolOverview({
  myTeam,
  enemyTeam,
  customPools,
  contestedChampions,
  onAddBan,
  onAddPriority,
}: PoolOverviewProps) {
  const hasTeamData = myTeam || enemyTeam;

  if (!hasTeamData && customPools.length === 0) {
    return (
      <Card variant="bordered" className="text-center py-8">
        <p className="text-gray-500">Select data sources to view pools</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Team Pools Side by Side */}
      {hasTeamData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {myTeam && (
            <TeamPoolSection
              team={myTeam}
              contestedChampions={contestedChampions}
              onChampionClick={onAddPriority}
              side="my"
            />
          )}
          {enemyTeam && (
            <TeamPoolSection
              team={enemyTeam}
              contestedChampions={contestedChampions}
              onChampionClick={onAddBan}
              side="enemy"
            />
          )}
        </div>
      )}

      {/* Custom Pools */}
      {customPools.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {customPools.map((pool) => (
            <CustomPoolSection
              key={pool.id}
              pool={pool}
              contestedChampions={contestedChampions}
              onChampionClick={onAddPriority}
            />
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 text-[10px] text-gray-500">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-yellow-500 rounded-full" />
          <span>Contested</span>
        </div>
        <span>Click champion to add to priority/ban</span>
      </div>
    </div>
  );
}
