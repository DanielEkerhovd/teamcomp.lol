import { Player } from '../../types';
import { useRankStore } from '../../stores/useRankStore';
import { formatRank, getRankColor, getRankBgColor } from '../../lib/riot';

interface RankBadgeProps {
  player: Player;
  showWinRate?: boolean;
  compact?: boolean;
}

export default function RankBadge({ player, showWinRate = false, compact = false }: RankBadgeProps) {
  const { getRank, isFetching, isFetchingFromCache, isConfigured } = useRankStore();

  const playerKey = {
    summonerName: player.summonerName,
    tagLine: player.tagLine,
    region: player.region,
  };

  const rankData = getRank(playerKey);
  const loading = isFetching(playerKey) || isFetchingFromCache(playerKey);

  // Don't show anything if API not configured or no player name
  if (!isConfigured() || !player.summonerName || !player.tagLine) {
    return null;
  }

  // Loading state
  if (loading) {
    return (
      <span className={`inline-flex items-center gap-1 ${compact ? 'text-[10px]' : 'text-xs'} text-gray-500`}>
        <svg
          className={`${compact ? 'w-3 h-3' : 'w-4 h-4'} animate-spin`}
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      </span>
    );
  }

  // Error state
  if (rankData?.error) {
    return (
      <span
        className={`inline-flex items-center gap-1 ${compact ? 'text-[10px]' : 'text-xs'} text-red-400/70`}
        title={rankData.error}
      >
        <span className="w-2 h-2 rounded-full bg-red-400/50" />
        Error
      </span>
    );
  }

  // Not fetched yet - show nothing (user needs to click Fetch Ranks button)
  if (!rankData) {
    return null;
  }

  const rank = rankData.rank;
  const rankText = formatRank(rank);
  const colorClass = getRankColor(rank?.tier || null);
  const bgClass = getRankBgColor(rank?.tier || null);

  return (
    <span
      className={`inline-flex items-center gap-1.5 ${bgClass} ${colorClass} ${
        compact ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5'
      } rounded-full font-medium`}
      title={
        rank
          ? `${rankText} - ${rank.wins}W ${rank.losses}L (${rank.winRate}% WR)`
          : 'Unranked'
      }
    >
      <span>{rankText}</span>
      {showWinRate && rank && (
        <span className="text-gray-400 font-normal">
          {rank.winRate}%
        </span>
      )}
    </span>
  );
}
