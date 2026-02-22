import { useEffect, useState, useCallback } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { useMasteryStore } from '../../stores/useMasteryStore';
import { useChampionData } from '../../hooks/useChampionData';
import { formatMasteryPoints } from '../../lib/mastery';
import { Player } from '../../types';

// Draggable mastery champion component
function DraggableMasteryChampion({
  championId,
  iconUrl,
  index,
  points,
}: {
  championId: string;
  iconUrl: string;
  index: number;
  points: number;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `mastery:${championId}`,
    data: { type: 'mastery-champion', championId },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`flex flex-col items-center gap-1 cursor-grab active:cursor-grabbing ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      <div className="relative">
        <img
          src={iconUrl}
          alt={championId}
          className="w-12 h-12 rounded border border-lol-border"
          loading="lazy"
        />
        {/* Rank badge */}
        <div className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-lol-dark border border-lol-border flex items-center justify-center text-[10px] font-bold text-lol-gold">
          {index + 1}
        </div>
      </div>
      <span className="text-[10px] text-gray-400 font-medium">
        {formatMasteryPoints(points)}
      </span>
    </div>
  );
}

// 24 hour cooldown for manual refresh
const MANUAL_REFRESH_COOLDOWN_MS = 24 * 60 * 60 * 1000;

function getLocalRefreshKey(summonerName: string, tagLine: string, region: string): string {
  return `mastery-refresh-${summonerName.toLowerCase()}#${tagLine.toLowerCase()}@${region}`;
}

function canManualRefresh(summonerName: string, tagLine: string, region: string): boolean {
  const key = getLocalRefreshKey(summonerName, tagLine, region);
  const lastRefresh = localStorage.getItem(key);
  if (!lastRefresh) return true;
  return Date.now() - parseInt(lastRefresh, 10) >= MANUAL_REFRESH_COOLDOWN_MS;
}

function setManualRefreshTime(summonerName: string, tagLine: string, region: string): void {
  const key = getLocalRefreshKey(summonerName, tagLine, region);
  localStorage.setItem(key, Date.now().toString());
}

interface MasteryDisplayProps {
  player: Player;
}

export default function MasteryDisplay({ player }: MasteryDisplayProps) {
  const { champions, getIconUrl } = useChampionData();
  const { getMastery, fetchMasteriesFromCache, fetchMasteryForPlayer, isFetching, isConfigured } = useMasteryStore();
  const [justUpdated, setJustUpdated] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Auto-fetch from cache on mount
  useEffect(() => {
    if (!isConfigured() || !player.summonerName || !player.tagLine) return;
    fetchMasteriesFromCache([{
      summonerName: player.summonerName,
      tagLine: player.tagLine,
      region: player.region,
    }]);
  }, [player.summonerName, player.tagLine, player.region, fetchMasteriesFromCache, isConfigured]);

  // Reset justUpdated after 3 seconds
  useEffect(() => {
    if (justUpdated) {
      const timer = setTimeout(() => setJustUpdated(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [justUpdated]);

  const masteryData = getMastery({
    summonerName: player.summonerName,
    tagLine: player.tagLine,
    region: player.region,
  });

  const loading = isFetching({
    summonerName: player.summonerName,
    tagLine: player.tagLine,
    region: player.region,
  });

  const handleManualRefresh = useCallback(async () => {
    if (!player.summonerName || !player.tagLine) return;
    if (!canManualRefresh(player.summonerName, player.tagLine, player.region)) return;
    if (isRefreshing) return;

    setIsRefreshing(true);
    try {
      await fetchMasteryForPlayer({
        summonerName: player.summonerName,
        tagLine: player.tagLine,
        region: player.region,
      });
      setManualRefreshTime(player.summonerName, player.tagLine, player.region);
      setJustUpdated(true);
    } finally {
      setIsRefreshing(false);
    }
  }, [player.summonerName, player.tagLine, player.region, fetchMasteryForPlayer, isRefreshing]);

  const canRefreshNow = player.summonerName && player.tagLine &&
    canManualRefresh(player.summonerName, player.tagLine, player.region);

  // Convert numeric championId to string id using the key field
  const getChampionIdByKey = (numericKey: number): string | null => {
    const champion = champions.find((c) => c.key === String(numericKey));
    return champion?.id || null;
  };

  // Refresh button component
  const RefreshButton = () => (
    <button
      onClick={handleManualRefresh}
      disabled={!canRefreshNow || isRefreshing}
      className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
        justUpdated
          ? 'bg-green-500/20 text-green-400 cursor-default'
          : canRefreshNow && !isRefreshing
          ? 'bg-lol-surface hover:bg-lol-gold/20 text-gray-400 hover:text-lol-gold'
          : 'bg-lol-surface/50 text-gray-600 cursor-not-allowed'
      }`}
      title={
        justUpdated
          ? 'Updated!'
          : canRefreshNow
          ? 'Refresh mastery data'
          : 'Refresh available in 24 hours'
      }
    >
      {justUpdated ? (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg
          className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
      )}
    </button>
  );

  if (!player.summonerName || !player.tagLine) {
    return (
      <div className="bg-lol-dark/50 rounded-xl p-4 border border-lol-border">
        <h4 className="text-sm font-medium text-gray-400 mb-3">Player mastery points</h4>
        <p className="text-xs text-gray-500 text-center py-4">
          Add a player to see mastery data
        </p>
      </div>
    );
  }

  if (loading && !masteryData) {
    return (
      <div className="bg-lol-dark/50 rounded-xl p-4 border border-lol-border">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-gray-400">Player mastery points</h4>
          <RefreshButton />
        </div>
        <div className="flex gap-2 justify-center py-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="w-12 h-12 rounded bg-lol-surface animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!masteryData || masteryData.masteries.length === 0) {
    return (
      <div className="bg-lol-dark/50 rounded-xl p-4 border border-lol-border">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-gray-400">Player mastery points</h4>
          <RefreshButton />
        </div>
        <p className="text-xs text-gray-500 text-center py-4">
          {masteryData?.error || 'No mastery data available. Click refresh to fetch.'}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-lol-dark/50 rounded-xl p-4 border border-lol-border">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-gray-400">Top Mastery Champions</h4>
        <RefreshButton />
      </div>
      <div className="flex gap-3 justify-center">
        {masteryData.masteries.map((mastery, index) => {
          const championId = getChampionIdByKey(mastery.championId);
          if (!championId) return null;

          const iconUrl = getIconUrl(championId);

          return (
            <DraggableMasteryChampion
              key={mastery.championId}
              championId={championId}
              iconUrl={iconUrl}
              index={index}
              points={mastery.championPoints}
            />
          );
        })}
      </div>
    </div>
  );
}
