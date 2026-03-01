import { useState, useMemo } from "react";
import { Team, DraftSession, ChampionGroup } from "../../types";
import { useCustomPoolStore } from "../../stores/useCustomPoolStore";
import { usePlayerPoolStore } from "../../stores/usePlayerPoolStore";
import { useDraftStore } from "../../stores/useDraftStore";
import { useEnemyTeamStore } from "../../stores/useEnemyTeamStore";
import { useMyTeamStore } from "../../stores/useMyTeamStore";
import { useDraftAnalytics } from "./hooks/useDraftAnalytics";
import BanPlanningPanel from "./BanPlanningPanel";
import ContestedAnalysis from "./ContestedAnalysis";
import PoolOverview from "./PoolOverview";
import GroupedChampionList from "./GroupedChampionList";
import { ChampionIcon } from "../champion";
import { OpggLinks } from "../team";

type ViewType = "bans" | "pools";
type DataFilter = "bans" | "priorities" | "contests" | null;

// Helper to get all champion IDs from an enemy team's pools
const getTeamChampionIds = (team: Team): Set<string> => {
  const ids = new Set<string>();
  team.players.forEach((player) => {
    player.championPool?.forEach((c) => ids.add(c.championId));
    player.championGroups?.forEach((group) => {
      group.championIds.forEach((id) => ids.add(id));
    });
  });
  return ids;
};

// Helper to get champion count for my team (uses playerPools)
const getMyTeamChampionCount = (
  team: Team,
  playerPools: {
    summonerName: string;
    role: string;
    championGroups?: { championIds: string[] }[];
  }[],
): number => {
  const ids = new Set<string>();
  team.players.forEach((player) => {
    if (player.summonerName) {
      const playerPool = playerPools.find(
        (p) =>
          p.summonerName.toLowerCase() === player.summonerName.toLowerCase() &&
          p.role === player.role,
      );
      if (playerPool) {
        playerPool.championGroups?.forEach((group) => {
          group.championIds.forEach((id) => ids.add(id));
        });
      }
    }
  });
  return ids.size;
};

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
  onReorderChampionsInBanGroup: (
    groupId: string,
    championIds: string[],
  ) => void;
  onMoveChampionBetweenBanGroups: (
    fromGroupId: string,
    toGroupId: string,
    championId: string,
    toIndex?: number,
  ) => void;
  // Priority group actions
  onAddPriorityGroup: (name: string) => void;
  onRenamePriorityGroup: (groupId: string, name: string) => void;
  onDeletePriorityGroup: (groupId: string) => void;
  onReorderPriorityGroups: (groupIds: string[]) => void;
  onAddChampionToPriorityGroup: (groupId: string, championId: string) => void;
  onRemoveChampionFromPriorityGroup: (
    groupId: string,
    championId: string,
  ) => void;
  onReorderChampionsInPriorityGroup: (
    groupId: string,
    championIds: string[],
  ) => void;
  onMoveChampionBetweenPriorityGroups: (
    fromGroupId: string,
    toGroupId: string,
    championId: string,
    toIndex?: number,
  ) => void;
}

// Helper to get all champion IDs from groups
function getAllChampionIds(groups: ChampionGroup[]): string[] {
  return groups.flatMap((g) => g.championIds);
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
  const [activeView, setActiveView] = useState<ViewType>("bans");
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Link Draft state
  const allSessions = useDraftStore((s) => s.sessions);
  const [linkedDraftId, setLinkedDraftId] = useState<string | null>(null);
  const [showDraftDropdown, setShowDraftDropdown] = useState(false);
  const [draftSearch, setDraftSearch] = useState("");
  const [activeDataFilter, setActiveDataFilter] = useState<DataFilter>(null);

  // Pool filter state
  const allMyTeams = useMyTeamStore((s) => s.teams);
  const allEnemyTeams = useEnemyTeamStore((s) => s.teams);
  const [selectedPoolMyTeamIds, setSelectedPoolMyTeamIds] = useState<string[]>(
    [],
  );
  const [selectedPoolEnemyTeamIds, setSelectedPoolEnemyTeamIds] = useState<
    string[]
  >([]);
  const [showPoolDropdown, setShowPoolDropdown] = useState(false);
  const [poolSearch, setPoolSearch] = useState("");
  const hasPoolFilter =
    selectedPoolMyTeamIds.length > 0 || selectedPoolEnemyTeamIds.length > 0;

  // Stores
  const { pools: customPools } = useCustomPoolStore();
  const { pools: playerPools } = usePlayerPoolStore();

  // Resolve linked draft session (exclude current session from list)
  const linkedDraftSession = useMemo(() => {
    if (!linkedDraftId) return null;
    return allSessions.find((s) => s.id === linkedDraftId) ?? null;
  }, [linkedDraftId, allSessions]);

  const availableDraftSessions = useMemo(() => {
    return allSessions.filter((s) => s.id !== session.id);
  }, [allSessions, session.id]);

  const filteredDraftSessions = useMemo(() => {
    if (!draftSearch) return availableDraftSessions;
    const q = draftSearch.toLowerCase();
    return availableDraftSessions.filter((s) =>
      s.name.toLowerCase().includes(q),
    );
  }, [availableDraftSessions, draftSearch]);

  // Get groups (with fallback for migration)
  const banGroups = session.banGroups || [];
  const priorityGroups = session.priorityGroups || [];

  // Get flat arrays for panels that need them
  const currentBans = getAllChampionIds(banGroups);

  // Analytics (for current session)
  const analytics = useDraftAnalytics({
    myTeam,
    enemyTeam,
    customPools,
    selectedCustomPoolIds: [],
    tierFilter: ["S", "A", "B", "C"],
    playerPools,
  });

  // Linked draft data
  const linkedBanGroups = useMemo(
    () => linkedDraftSession?.banGroups ?? [],
    [linkedDraftSession],
  );
  const linkedPriorityGroups = useMemo(
    () => linkedDraftSession?.priorityGroups ?? [],
    [linkedDraftSession],
  );
  const linkedBanCount = useMemo(
    () => linkedBanGroups.reduce((sum, g) => sum + g.championIds.length, 0),
    [linkedBanGroups],
  );
  const linkedPriorityCount = useMemo(
    () =>
      linkedPriorityGroups.reduce((sum, g) => sum + g.championIds.length, 0),
    [linkedPriorityGroups],
  );

  // Resolve linked draft's teams for contested calculation
  const linkedEnemyTeam = useMemo(() => {
    if (!linkedDraftSession?.enemyTeamId) return null;
    return (
      allEnemyTeams.find((t) => t.id === linkedDraftSession.enemyTeamId) ?? null
    );
  }, [linkedDraftSession, allEnemyTeams]);

  const linkedMyTeam = useMemo(() => {
    if (!linkedDraftSession?.myTeamId) return null;
    return allMyTeams.find((t) => t.id === linkedDraftSession.myTeamId) ?? null;
  }, [linkedDraftSession, allMyTeams]);

  const linkedAnalytics = useDraftAnalytics({
    myTeam: linkedMyTeam,
    enemyTeam: linkedEnemyTeam,
    customPools,
    selectedCustomPoolIds: [],
    tierFilter: ["S", "A", "B", "C"],
    playerPools,
  });

  const contestedChampionIds = useMemo(
    () => new Set(linkedAnalytics.contested.map((c) => c.championId)),
    [linkedAnalytics.contested],
  );
  const contestedCount = contestedChampionIds.size;

  // Active groups for the data filter view
  const activeGroups: ChampionGroup[] | null = useMemo(() => {
    if (activeDataFilter === "bans") return linkedBanGroups;
    if (activeDataFilter === "priorities") return linkedPriorityGroups;
    if (activeDataFilter === "contests") {
      if (contestedChampionIds.size === 0) return [];
      return [
        {
          id: "contested",
          name: "Contested Picks",
          championIds: [...contestedChampionIds],
        },
      ];
    }
    return null;
  }, [
    activeDataFilter,
    linkedBanGroups,
    linkedPriorityGroups,
    contestedChampionIds,
  ]);

  // Pool filter champion IDs
  const poolFilterChampionIds = useMemo(() => {
    const ids = new Set<string>();
    selectedPoolMyTeamIds.forEach((teamId) => {
      const team = allMyTeams.find((t) => t.id === teamId);
      if (team) {
        team.players.forEach((player) => {
          if (player.summonerName) {
            const playerPool = playerPools.find(
              (p) =>
                p.summonerName.toLowerCase() ===
                  player.summonerName.toLowerCase() && p.role === player.role,
            );
            if (playerPool) {
              playerPool.championGroups?.forEach((group) => {
                group.championIds.forEach((id) => ids.add(id));
              });
            }
          }
        });
      }
    });
    selectedPoolEnemyTeamIds.forEach((teamId) => {
      const team = allEnemyTeams.find((t) => t.id === teamId);
      if (team) getTeamChampionIds(team).forEach((id) => ids.add(id));
    });
    return ids;
  }, [
    selectedPoolMyTeamIds,
    selectedPoolEnemyTeamIds,
    allMyTeams,
    allEnemyTeams,
    playerPools,
  ]);

  const toggleDataFilter = (filter: DataFilter) => {
    setActiveDataFilter((prev) => (prev === filter ? null : filter));
  };

  const views: { id: ViewType; label: string }[] = [
    { id: "bans", label: "Draft Planning" },
    { id: "pools", label: "All Pools" },
  ];

  return (
    <div className="space-y-4">
      {/* View Tabs + Link Draft + Pool Filter */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 rounded-lg bg-lol-dark border border-lol-border text-gray-400 hover:text-white hover:border-lol-border-light transition-all"
            title={isCollapsed ? "Expand" : "Collapse"}
          >
            <svg
              className={`w-4 h-4 transition-transform ${isCollapsed ? "-rotate-90" : "rotate-0"}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          <div className="flex gap-1 bg-lol-dark p-1 rounded-xl">
            {views.map((view) => (
              <button
                key={view.id}
                onClick={() => setActiveView(view.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeView === view.id && !activeDataFilter
                    ? "bg-lol-surface text-white"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                {view.label}
              </button>
            ))}
          </div>

          {enemyTeam && <OpggLinks team={enemyTeam} compact />}

          {/* Link Draft Dropdown */}
          <div className="relative shrink-0">
            <button
              onClick={() => {
                setShowDraftDropdown(!showDraftDropdown);
                setDraftSearch("");
              }}
              className={`
                flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all
                ${
                  linkedDraftSession
                    ? "bg-lol-gold/15 text-lol-gold border border-lol-gold/40"
                    : "bg-lol-dark text-gray-400 border border-lol-border hover:text-gray-300 hover:border-lol-border-light"
                }
              `}
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <span className="max-w-28 truncate">
                {linkedDraftSession ? linkedDraftSession.name : "Link Draft"}
              </span>
              <svg
                className={`w-3 h-3 transition-transform ${showDraftDropdown ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {showDraftDropdown && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowDraftDropdown(false)}
                />
                <div className="absolute top-full left-0 mt-1 z-20 min-w-64 bg-lol-card border border-lol-border rounded-lg shadow-xl overflow-hidden">
                  <div className="p-2">
                    <input
                      type="text"
                      value={draftSearch}
                      onChange={(e) => setDraftSearch(e.target.value)}
                      placeholder="Search drafts..."
                      autoFocus
                      className="w-full px-2.5 py-1.5 bg-lol-dark border border-lol-border rounded-lg text-white text-xs placeholder-gray-500 focus:outline-none focus:border-lol-gold/50"
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {linkedDraftId && (
                      <button
                        onClick={() => {
                          setLinkedDraftId(null);
                          setShowDraftDropdown(false);
                          setActiveDataFilter(null);
                        }}
                        className="w-full px-3 py-2 text-xs text-gray-400 hover:text-white hover:bg-lol-surface text-left flex items-center gap-2"
                      >
                        <svg
                          className="w-3.5 h-3.5 text-red-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                        Unlink draft
                      </button>
                    )}
                    {filteredDraftSessions.length === 0 ? (
                      <div className="px-3 py-3 text-xs text-gray-500 text-center">
                        {availableDraftSessions.length === 0
                          ? "No other draft sessions"
                          : "No matches"}
                      </div>
                    ) : (
                      filteredDraftSessions.map((ds) => (
                        <button
                          key={ds.id}
                          onClick={() => {
                            setLinkedDraftId(ds.id);
                            setShowDraftDropdown(false);
                          }}
                          className={`w-full px-3 py-2 text-xs text-left hover:bg-lol-surface transition-colors flex items-center gap-2 ${
                            ds.id === linkedDraftId
                              ? "text-lol-gold bg-lol-gold/10"
                              : "text-gray-300"
                          }`}
                        >
                          <span className="flex-1 truncate">{ds.name}</span>
                          {ds.id === linkedDraftId && (
                            <svg
                              className="w-3.5 h-3.5 text-lol-gold shrink-0"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Pool Filter Dropdown */}
          {(allMyTeams.length > 0 || allEnemyTeams.length > 0) && (
            <div className="relative shrink-0">
              <button
                onClick={() => {
                  setShowPoolDropdown(!showPoolDropdown);
                  setPoolSearch("");
                }}
                className={`
                  flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all
                  ${
                    hasPoolFilter
                      ? "bg-purple-500/20 text-purple-400 border border-purple-500/50"
                      : "bg-lol-dark text-gray-400 border border-lol-border hover:text-gray-300 hover:border-lol-border-light"
                  }
                `}
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                  />
                </svg>
                <span>Pools</span>
                {hasPoolFilter && (
                  <span className="bg-purple-500/30 px-1 py-0.5 rounded text-[10px]">
                    {selectedPoolMyTeamIds.length +
                      selectedPoolEnemyTeamIds.length}
                  </span>
                )}
              </button>

              {showPoolDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowPoolDropdown(false)}
                  />
                  <div className="absolute top-full left-0 mt-1 z-20 min-w-56 bg-lol-card border border-lol-border rounded-lg shadow-xl overflow-hidden">
                    {/* My Teams */}
                    {allMyTeams.length > 0 && (
                      <div className="p-2">
                        <div className="text-[10px] text-gray-500 uppercase tracking-wide px-2 mb-1">
                          My Teams
                        </div>
                        {allMyTeams.map((team) => {
                          const isSelected = selectedPoolMyTeamIds.includes(
                            team.id,
                          );
                          const champCount = getMyTeamChampionCount(
                            team,
                            playerPools,
                          );
                          return (
                            <button
                              key={team.id}
                              onClick={() =>
                                setSelectedPoolMyTeamIds((prev) =>
                                  prev.includes(team.id)
                                    ? prev.filter((id) => id !== team.id)
                                    : [...prev, team.id],
                                )
                              }
                              className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-left transition-all ${
                                isSelected
                                  ? "bg-blue-500/20 text-blue-400"
                                  : "text-gray-400 hover:bg-lol-surface hover:text-white"
                              }`}
                            >
                              <div
                                className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center shrink-0 ${
                                  isSelected
                                    ? "border-blue-500 bg-blue-500"
                                    : "border-gray-600"
                                }`}
                              >
                                {isSelected && (
                                  <svg
                                    className="w-2.5 h-2.5 text-white"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                )}
                              </div>
                              <span className="flex-1 truncate">
                                {team.name || "My Team"}
                              </span>
                              <span className="text-[10px] text-gray-500">
                                {champCount}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {allMyTeams.length > 0 && allEnemyTeams.length > 0 && (
                      <div className="border-t border-lol-border" />
                    )}
                    {/* Enemy Teams */}
                    {allEnemyTeams.length > 0 && (
                      <div className="p-2">
                        <div className="text-[10px] text-gray-500 uppercase tracking-wide px-2 mb-1">
                          Enemy Teams
                        </div>
                        <div className="px-1 mb-1">
                          <input
                            type="text"
                            value={poolSearch}
                            onChange={(e) => setPoolSearch(e.target.value)}
                            placeholder="Search teams..."
                            className="w-full px-2.5 py-1.5 bg-lol-dark border border-lol-border rounded-lg text-white text-xs placeholder-gray-500 focus:outline-none focus:border-lol-gold/50"
                          />
                        </div>
                        {allEnemyTeams
                          .filter(
                            (t) =>
                              !poolSearch ||
                              t.name
                                .toLowerCase()
                                .includes(poolSearch.toLowerCase()),
                          )
                          .map((team) => {
                            const isSelected =
                              selectedPoolEnemyTeamIds.includes(team.id);
                            const champCount = getTeamChampionIds(team).size;
                            return (
                              <button
                                key={team.id}
                                onClick={() =>
                                  setSelectedPoolEnemyTeamIds((prev) =>
                                    prev.includes(team.id)
                                      ? prev.filter((id) => id !== team.id)
                                      : [...prev, team.id],
                                  )
                                }
                                className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-left transition-all ${
                                  isSelected
                                    ? "bg-red-500/20 text-red-400"
                                    : "text-gray-400 hover:bg-lol-surface hover:text-white"
                                }`}
                              >
                                <div
                                  className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center shrink-0 ${
                                    isSelected
                                      ? "border-red-500 bg-red-500"
                                      : "border-gray-600"
                                  }`}
                                >
                                  {isSelected && (
                                    <svg
                                      className="w-2.5 h-2.5 text-white"
                                      fill="currentColor"
                                      viewBox="0 0 20 20"
                                    >
                                      <path
                                        fillRule="evenodd"
                                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                        clipRule="evenodd"
                                      />
                                    </svg>
                                  )}
                                </div>
                                <span className="flex-1 truncate">
                                  vs {team.name}
                                </span>
                                <span className="text-[10px] text-gray-500">
                                  {champCount}
                                </span>
                              </button>
                            );
                          })}
                      </div>
                    )}
                    {hasPoolFilter && (
                      <>
                        <div className="border-t border-lol-border" />
                        <div className="p-2">
                          <button
                            onClick={() => {
                              setSelectedPoolMyTeamIds([]);
                              setSelectedPoolEnemyTeamIds([]);
                            }}
                            className="w-full px-3 py-1.5 text-xs text-gray-400 hover:text-white hover:bg-lol-surface rounded-lg text-center transition-all"
                          >
                            Clear All
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Quick Stats + Data Filter Buttons */}
        <div className="flex items-center gap-3">
          {/* Data Filter Buttons (only when a draft is linked) */}
          {linkedDraftSession && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => toggleDataFilter("bans")}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-all ${
                  activeDataFilter === "bans"
                    ? "bg-red-500/20 text-red-400 border border-red-500/50"
                    : "bg-lol-dark text-gray-400 border border-lol-border hover:text-red-400 hover:border-red-500/30"
                }`}
              >
                Bans
                {linkedBanCount > 0 && (
                  <span
                    className={`px-1 rounded text-[10px] ${activeDataFilter === "bans" ? "bg-red-500/30" : "bg-gray-600/50"}`}
                  >
                    {linkedBanCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => toggleDataFilter("priorities")}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-all ${
                  activeDataFilter === "priorities"
                    ? "bg-lol-gold/20 text-lol-gold border border-lol-gold/50"
                    : "bg-lol-dark text-gray-400 border border-lol-border hover:text-lol-gold hover:border-lol-gold/30"
                }`}
              >
                Priorities
                {linkedPriorityCount > 0 && (
                  <span
                    className={`px-1 rounded text-[10px] ${activeDataFilter === "priorities" ? "bg-lol-gold/30" : "bg-gray-600/50"}`}
                  >
                    {linkedPriorityCount}
                  </span>
                )}
              </button>
              {contestedCount > 0 && (
                <button
                  onClick={() => toggleDataFilter("contests")}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-all ${
                    activeDataFilter === "contests"
                      ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/50"
                      : "bg-lol-dark text-gray-400 border border-lol-border hover:text-yellow-400 hover:border-yellow-500/30"
                  }`}
                >
                  Contested
                  <span
                    className={`px-1 rounded text-[10px] ${activeDataFilter === "contests" ? "bg-yellow-500/30" : "bg-gray-600/50"}`}
                  >
                    {contestedCount}
                  </span>
                </button>
              )}
            </div>
          )}

          {enemyTeam && !isCollapsed && (
            <div className="flex gap-4 text-xs text-gray-500">
              <span>
                <span className="text-white font-medium">
                  {analytics.banCandidates.length}
                </span>{" "}
                ban targets
              </span>
              <span>
                <span className="text-yellow-400 font-medium">
                  {analytics.contested.length}
                </span>{" "}
                contested
              </span>
              <span>
                <span className="text-purple-400 font-medium">
                  {analytics.enemyFlexPicks.length}
                </span>{" "}
                enemy flex picks
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Linked Draft Grouped View (when a data filter is active) */}
      {activeDataFilter && activeGroups !== null && (
        <div className="rounded-xl border border-lol-border bg-lol-card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <svg
                className="w-3.5 h-3.5 text-lol-gold"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              From:{" "}
              <span className="text-lol-gold font-medium">
                {linkedDraftSession?.name}
              </span>
            </div>
            <button
              onClick={() => setActiveDataFilter(null)}
              className="text-xs text-gray-500 hover:text-white transition-colors"
            >
              Close
            </button>
          </div>
          {activeGroups.length === 0 ? (
            <div className="text-center py-6 text-gray-500 text-sm">
              {activeDataFilter === "bans"
                ? "No bans planned"
                : activeDataFilter === "priorities"
                  ? "No priorities set"
                  : "No contested picks"}
            </div>
          ) : (
            <div className="space-y-4">
              {activeGroups.map((group) => (
                <div key={group.id}>
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`text-xs font-medium uppercase tracking-wide ${
                        activeDataFilter === "bans"
                          ? "text-red-400"
                          : activeDataFilter === "priorities"
                            ? "text-lol-gold"
                            : "text-yellow-400"
                      }`}
                    >
                      {group.name}
                    </span>
                    <span className="text-[10px] text-gray-500">
                      ({group.championIds.length})
                    </span>
                    <div className="flex-1 h-px bg-lol-border/50" />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {group.championIds
                      .filter(
                        (id) => !hasPoolFilter || poolFilterChampionIds.has(id),
                      )
                      .map((championId) => (
                        <ChampionIcon
                          key={championId}
                          championId={championId}
                          size="lg"
                          showName
                          onClick={() => {
                            if (activeDataFilter === "bans")
                              onAddBan(championId);
                            else onAddPriority(championId);
                          }}
                        />
                      ))}
                    {/* Show grayed-out champions not in pool */}
                    {hasPoolFilter &&
                      group.championIds.filter(
                        (id) => !poolFilterChampionIds.has(id),
                      ).length > 0 && (
                        <>
                          <div className="w-full flex items-center gap-2 my-1">
                            <div className="flex-1 h-px bg-lol-border/30" />
                            <span className="text-[10px] text-gray-600">
                              Not in pools
                            </span>
                            <div className="flex-1 h-px bg-lol-border/30" />
                          </div>
                          {group.championIds
                            .filter((id) => !poolFilterChampionIds.has(id))
                            .map((championId) => (
                              <div key={championId} className="opacity-40">
                                <ChampionIcon
                                  championId={championId}
                                  size="lg"
                                  showName
                                  onClick={() => {
                                    if (activeDataFilter === "bans")
                                      onAddBan(championId);
                                    else onAddPriority(championId);
                                  }}
                                />
                              </div>
                            ))}
                        </>
                      )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Collapsible Content (Suggestions & Pools) */}
      {!isCollapsed && !activeDataFilter && (
        <>
          {activeView === "bans" && (
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

          {activeView === "pools" && (
            <PoolOverview
              myTeam={myTeam}
              enemyTeam={enemyTeam}
              customPools={customPools}
              contestedChampions={
                new Set(analytics.contested.map((c) => c.championId))
              }
              tierFilter={["S", "A", "B", "C"]}
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
