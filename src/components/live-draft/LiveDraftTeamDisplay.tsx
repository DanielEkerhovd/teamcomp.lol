import { useMemo } from 'react';
import { ChampionIcon } from '../champion';
import RoleIcon from '../team/RoleIcon';
import type { Player, Role, Team, ChampionGroup } from '../../types';
import type { DraftSide } from '../../types/liveDraft';
import { usePlayerPoolStore } from '../../stores/usePlayerPoolStore';

interface PlayerRowProps {
  player: Player;
  side: DraftSide;
  championGroups?: ChampionGroup[];
}

function PlayerRow({ player, side, championGroups }: PlayerRowProps) {
  // Get all champion IDs from groups
  const championIds = useMemo(() => {
    const groups = championGroups || player.championGroups || [];
    const ids: string[] = [];
    groups.forEach((g) => {
      g.championIds.forEach((id) => {
        if (!ids.includes(id)) {
          ids.push(id);
        }
      });
    });
    return ids;
  }, [championGroups, player.championGroups]);

  const displayChampions = championIds.slice(0, 5);
  const remainingCount = championIds.length - 5;

  const sideColor = side === 'blue' ? 'blue' : 'red';
  const borderColor = side === 'blue' ? 'border-blue-500/30' : 'border-red-500/30';
  const bgColor = side === 'blue' ? 'bg-blue-500/5' : 'bg-red-500/5';

  return (
    <div
      className={`flex items-center gap-3 p-2 rounded-lg border ${borderColor} ${bgColor} transition-all hover:bg-opacity-10`}
    >
      {/* Role Icon */}
      <div className="shrink-0">
        <RoleIcon role={player.role} size="md" />
      </div>

      {/* Player Name */}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-white truncate text-sm">
          {player.summonerName || <span className="text-gray-500 italic">Empty</span>}
        </div>
        {player.tagLine && (
          <div className="text-xs text-gray-500 truncate">#{player.tagLine}</div>
        )}
      </div>

      {/* Champion Pool Preview */}
      <div className="flex items-center gap-1 shrink-0">
        {displayChampions.length > 0 ? (
          <>
            {displayChampions.map((champId) => (
              <ChampionIcon key={champId} championId={champId} size="xs" />
            ))}
            {remainingCount > 0 && (
              <span className="text-[10px] text-gray-500 ml-1 bg-lol-surface px-1.5 py-0.5 rounded">
                +{remainingCount}
              </span>
            )}
          </>
        ) : (
          <span className="text-xs text-gray-500">No pool</span>
        )}
      </div>
    </div>
  );
}

interface LiveDraftTeamDisplayProps {
  team: Team | null;
  side: DraftSide;
  teamName: string;
  captainName?: string | null;
  isReady?: boolean;
  showHeader?: boolean;
}

const ROLE_ORDER: Role[] = ['top', 'jungle', 'mid', 'adc', 'support'];

export default function LiveDraftTeamDisplay({
  team,
  side,
  teamName,
  captainName,
  isReady = false,
  showHeader = true,
}: LiveDraftTeamDisplayProps) {
  const playerPools = usePlayerPoolStore((s) => s.pools);

  // Get players sorted by role order
  const sortedPlayers = useMemo(() => {
    if (!team) return [];

    // Get main roster (not subs)
    const mainRoster = team.players.filter((p) => !p.isSub);

    // Sort by role order
    return [...mainRoster].sort((a, b) => {
      const aIndex = ROLE_ORDER.indexOf(a.role as Role);
      const bIndex = ROLE_ORDER.indexOf(b.role as Role);
      // If role not in order, put at end
      const aOrder = aIndex === -1 ? 99 : aIndex;
      const bOrder = bIndex === -1 ? 99 : bIndex;
      return aOrder - bOrder;
    });
  }, [team]);

  // Get champion pools for each player from the player pool store
  const getPlayerPool = (player: Player): ChampionGroup[] | undefined => {
    if (!player.summonerName) return undefined;

    const normalizedName = player.summonerName.toLowerCase().trim();
    const pool = playerPools.find(
      (p) =>
        (p.summonerName?.toLowerCase().trim() || '') === normalizedName &&
        p.role === player.role
    );

    return pool?.championGroups;
  };

  const sideColor = side === 'blue' ? 'blue' : 'red';
  const headerBorderColor =
    side === 'blue' ? 'border-blue-500' : 'border-red-500';
  const headerBgColor =
    side === 'blue' ? 'bg-blue-500/10' : 'bg-red-500/10';
  const headerTextColor = side === 'blue' ? 'text-blue-400' : 'text-red-400';

  return (
    <div className="space-y-2">
      {showHeader && (
        <div
          className={`flex items-center justify-between px-3 py-2 rounded-lg border ${headerBorderColor} ${headerBgColor}`}
        >
          <div>
            <div className={`text-xs font-bold uppercase tracking-wider ${headerTextColor}`}>
              {side} Side
            </div>
            <div className="text-white font-medium">{teamName}</div>
            {captainName && (
              <div className="text-xs text-gray-400">Captain: {captainName}</div>
            )}
          </div>
          {isReady && (
            <div className="flex items-center gap-1 text-green-400 text-sm">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Ready
            </div>
          )}
        </div>
      )}

      {team && sortedPlayers.length > 0 ? (
        <div className="space-y-1.5">
          {sortedPlayers.map((player) => (
            <PlayerRow
              key={player.id}
              player={player}
              side={side}
              championGroups={getPlayerPool(player)}
            />
          ))}
        </div>
      ) : (
        <div className="p-4 text-center text-gray-500 text-sm border border-dashed border-gray-600 rounded-lg">
          {team ? 'No players configured' : 'No team linked'}
        </div>
      )}
    </div>
  );
}
