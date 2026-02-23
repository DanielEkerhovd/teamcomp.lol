import { useState } from 'react';
import { Team, DraftSession, ChampionGroup } from '../../types';
import { useCustomPoolStore } from '../../stores/useCustomPoolStore';
import { usePlayerPoolStore } from '../../stores/usePlayerPoolStore';
import { useDraftAnalytics } from './hooks/useDraftAnalytics';
import BanPlanningPanel from './BanPlanningPanel';
import ContestedAnalysis from './ContestedAnalysis';
import PoolOverview from './PoolOverview';
import GroupedChampionList from './GroupedChampionList';
import { OpggLinks } from '../team';

type ViewType = 'bans' | 'pools';

interface DraftPlanningHubProps {
  myTeam: Team;
  enemyTeam: Team | null;
  session: DraftSession;
  // Legacy actions (for panels that add bans/priorities)
  onAddBan: (championId: string) => void;
  onRemoveBan: (championId: string) => void;
  onAddPriority: (championId: string) => void;
  onRemovePriority: (championId: string) => void;
  // Ban group actions
  onAddBanGroup: (name: string) => void;
  onRenameBanGroup: (groupId: string, name: string) => void;
  onDeleteBanGroup: (groupId: string) => void;
  onReorderBanGroups: (groupIds: string[]) => void;
  onAddChampionToBanGroup: (groupId: string, championId: string) => void;
  onRemoveChampionFromBanGroup: (groupId: string, championId: string) => void;
  onReorderChampionsInBanGroup: (groupId: string, championIds: string[]) => void;
  onMoveChampionBetweenBanGroups: (fromGroupId: string, toGroupId: string, championId: string, toIndex?: number) => void;
  // Priority group actions
  onAddPriorityGroup: (name: string) => void;
  onRenamePriorityGroup: (groupId: string, name: string) => void;
  onDeletePriorityGroup: (groupId: string) => void;
  onReorderPriorityGroups: (groupIds: string[]) => void;
  onAddChampionToPriorityGroup: (groupId: string, championId: string) => void;
  onRemoveChampionFromPriorityGroup: (groupId: string, championId: string) => void;
  onReorderChampionsInPriorityGroup: (groupId: string, championIds: string[]) => void;
  onMoveChampionBetweenPriorityGroups: (fromGroupId: string, toGroupId: string, championId: string, toIndex?: number) => void;
}

// Helper to get all champion IDs from groups
function getAllChampionIds(groups: ChampionGroup[]): string[] {
  return groups.flatMap(g => g.championIds);
}

export default function DraftPlanningHub({
  myTeam,
  enemyTeam,
  session,
  onAddBan,
  onRemoveBan,
  onAddPriority,
  onRemovePriority,
  onAddBanGroup,
  onRenameBanGroup,
  onDeleteBanGroup,
  onReorderBanGroups,
  onAddChampionToBanGroup,
  onRemoveChampionFromBanGroup,
  onReorderChampionsInBanGroup,
  onMoveChampionBetweenBanGroups,
  onAddPriorityGroup,
  onRenamePriorityGroup,
  onDeletePriorityGroup,
  onReorderPriorityGroups,
  onAddChampionToPriorityGroup,
  onRemoveChampionFromPriorityGroup,
  onReorderChampionsInPriorityGroup,
  onMoveChampionBetweenPriorityGroups,
}: DraftPlanningHubProps) {
  // View state
  const [activeView, setActiveView] = useState<ViewType>('bans');
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Stores
  const { pools: customPools } = useCustomPoolStore();
  const { pools: playerPools } = usePlayerPoolStore();

  // Get groups (with fallback for migration)
  const banGroups = session.banGroups || [];
  const priorityGroups = session.priorityGroups || [];

  // Get flat arrays for panels that need them
  const currentBans = getAllChampionIds(banGroups);

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

          {enemyTeam && (
            <OpggLinks team={enemyTeam} compact />
          )}
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
                currentBans={currentBans}
                onAddBan={onAddBan}
                onRemoveBan={onRemoveBan}
              />
              <ContestedAnalysis
                contested={analytics.contested}
                onAddBan={onAddBan}
                onAddPriority={onAddPriority}
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
              onAddPriority={onAddPriority}
            />
          )}
        </>
      )}

      {/* Current Bans & Priorities - Always visible */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Current Bans */}
        <GroupedChampionList
          title="Bans"
          groups={banGroups}
          variant="ban"
          onAddGroup={onAddBanGroup}
          onRenameGroup={onRenameBanGroup}
          onDeleteGroup={onDeleteBanGroup}
          onReorderGroups={onReorderBanGroups}
          onAddChampion={onAddChampionToBanGroup}
          onRemoveChampion={onRemoveChampionFromBanGroup}
          onReorderChampions={onReorderChampionsInBanGroup}
          onMoveChampion={onMoveChampionBetweenBanGroups}
          onAddToFirstGroup={onAddBan}
        />

        {/* Priorities */}
        <GroupedChampionList
          title="Our priorities"
          groups={priorityGroups}
          variant="priority"
          onAddGroup={onAddPriorityGroup}
          onRenameGroup={onRenamePriorityGroup}
          onDeleteGroup={onDeletePriorityGroup}
          onReorderGroups={onReorderPriorityGroups}
          onAddChampion={onAddChampionToPriorityGroup}
          onRemoveChampion={onRemoveChampionFromPriorityGroup}
          onReorderChampions={onReorderChampionsInPriorityGroup}
          onMoveChampion={onMoveChampionBetweenPriorityGroups}
          onAddToFirstGroup={onAddPriority}
        />
      </div>
    </div>
  );
}
