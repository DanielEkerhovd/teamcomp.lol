import { useState } from 'react';
import { Card } from '../ui';
import { ChampionIcon, ChampionSearch } from '../champion';
import { Team, DraftSession } from '../../types';
import { useChampionData } from '../../hooks/useChampionData';
import { useCustomPoolStore } from '../../stores/useCustomPoolStore';
import { usePlayerPoolStore } from '../../stores/usePlayerPoolStore';
import { useDraftAnalytics } from './hooks/useDraftAnalytics';
import BanPlanningPanel from './BanPlanningPanel';
import ContestedAnalysis from './ContestedAnalysis';
import PoolOverview from './PoolOverview';
import PriorityList from './PriorityList';

type ViewType = 'bans' | 'pools';

interface DraftPlanningHubProps {
  myTeam: Team;
  enemyTeam: Team | null;
  session: DraftSession;
  onAddBan: (championId: string) => void;
  onRemoveBan: (championId: string) => void;
  onAddPriority: (championId: string) => void;
  onRemovePriority: (championId: string) => void;
}

export default function DraftPlanningHub({
  myTeam,
  enemyTeam,
  session,
  onAddBan,
  onRemoveBan,
  onAddPriority,
  onRemovePriority,
}: DraftPlanningHubProps) {
  const { getChampionById } = useChampionData();

  // View state
  const [activeView, setActiveView] = useState<ViewType>('bans');
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Stores
  const { pools: customPools } = useCustomPoolStore();
  const { pools: playerPools } = usePlayerPoolStore();

  // Analytics
  const analytics = useDraftAnalytics({
    myTeam,
    enemyTeam,
    customPools,
    selectedCustomPoolIds: [],
    tierFilter: ['S', 'A', 'B', 'C'],
    playerPools,
  });

  const views: { id: ViewType; label: string }[] = [
    { id: 'bans', label: 'Draft Planning' },
    { id: 'pools', label: 'All Pools' },
  ];

  return (
    <div className="space-y-4">
      {/* View Tabs + Collapse Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 rounded-lg bg-lol-dark border border-lol-border text-gray-400 hover:text-white hover:border-lol-border-light transition-all"
            title={isCollapsed ? 'Expand' : 'Collapse'}
          >
            <svg
              className={`w-4 h-4 transition-transform ${isCollapsed ? '-rotate-90' : 'rotate-0'}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <div className="flex gap-1 bg-lol-dark p-1 rounded-xl">
            {views.map((view) => (
              <button
                key={view.id}
                onClick={() => setActiveView(view.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeView === view.id
                    ? 'bg-lol-surface text-white'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {view.label}
              </button>
            ))}
          </div>
        </div>

        {/* Quick Stats */}
        {enemyTeam && !isCollapsed && (
          <div className="flex gap-4 text-xs text-gray-500">
            <span>
              <span className="text-white font-medium">{analytics.banCandidates.length}</span> ban targets
            </span>
            <span>
              <span className="text-yellow-400 font-medium">{analytics.contested.length}</span> contested
            </span>
            <span>
              <span className="text-purple-400 font-medium">{analytics.enemyFlexPicks.length}</span> enemy flex picks
            </span>
          </div>
        )}
      </div>

      {/* Collapsible Content (Suggestions & Pools) */}
      {!isCollapsed && (
        <>
          {activeView === 'bans' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              <BanPlanningPanel
                banCandidates={analytics.banCandidates}
                currentBans={session.potentialBans}
                onAddBan={onAddBan}
                onRemoveBan={onRemoveBan}
              />
              <ContestedAnalysis
                contested={analytics.contested}
                onAddBan={onAddBan}
                onAddPriority={handleAddPriorityFromChampion}
              />
            </div>
          )}

          {activeView === 'pools' && (
            <PoolOverview
              myTeam={myTeam}
              enemyTeam={enemyTeam}
              customPools={customPools}
              contestedChampions={new Set(analytics.contested.map((c) => c.championId))}
              tierFilter={['S', 'A', 'B', 'C']}
              onAddBan={onAddBan}
              onAddPriority={handleAddPriorityFromChampion}
            />
          )}
        </>
      )}

      {/* Current Bans & Priorities - Always visible */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Current Bans */}
        <Card variant="bordered" padding="md">
          <h3 className="text-lg font-semibold text-red-400 mb-3">Current Bans</h3>
          <ChampionSearch
            onSelect={(champion) => onAddBan(champion.id)}
            placeholder="Add ban..."
            excludeIds={session.potentialBans}
            variant="minimal"
          />
          {session.potentialBans.length === 0 ? (
            <p className="text-gray-500 text-sm py-4 text-center mt-3">No bans added yet</p>
          ) : (
            <div className="flex flex-wrap gap-2 mt-3">
              {session.potentialBans.map((championId) => {
                const champion = getChampionById(championId);
                return (
                  <div
                    key={championId}
                    className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg group"
                  >
                    <ChampionIcon championId={championId} size="md" />
                    <span className="text-sm text-red-400">{champion?.name}</span>
                    <button
                      onClick={() => onRemoveBan(championId)}
                      className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-opacity"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Priorities */}
        <PriorityList
          priorities={session.ourPriorities}
          onAdd={onAddPriority}
          onRemove={onRemovePriority}
        />
      </div>
    </div>
  );
}
