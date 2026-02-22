import { Player } from '../../types';
import { useRankStore } from '../../stores/useRankStore';
import { formatRank, getRankColor, getRankBgColor } from '../../lib/riot';

interface RankBadgeProps {
  player: Player;
  showWinRate?: boolean;
  compact?: boolean;
}

export default function RankBadge({ player, showWinRate = false, compact = false }: RankBadgeProps) {
  const { getRank, isFetching, isConfigured } = useRankStore();

  const rankData = getRank({
    summonerName: player.summonerName,
    tagLine: player.tagLine,
    region: player.region,
  });

  const loading = isFetching({
    summonerName: player.summonerName,
    tagLine: player.tagLine,
    region: player.region,
  });

  // Don't show anything if API not configured or no player name
  if (!isConfigured() || !player.summonerName || !player.tagLine) {
    return null;
  }

  // Loading state
  if (loading) {
    return (
      <span className={`inline-flex items-center gap-1 ${compact ? 'text-[10px]' : 'text-xs'} text-gray-500`}>
        <span className="w-2 h-2 rounded-full bg-gray-500 animate-pulse" />
        <span className="animate-pulse">...</span>
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
