import { useState, useMemo } from "react";
import { useChampionData } from "../../hooks/useChampionData";
import { championPlaysRole } from "../../data/championRoles";
import { NONE_CHAMPION } from "../../types/liveDraft";
import { ROLES } from "../../types";
import type { Role, DraftSession, Team, ChampionGroup } from "../../types";
import RoleIcon from "../team/RoleIcon";
import { useMyTeamStore } from "../../stores/useMyTeamStore";
import { useEnemyTeamStore } from "../../stores/useEnemyTeamStore";
import { usePlayerPoolStore } from "../../stores/usePlayerPoolStore";

type RoleFilter = "all" | Role;
type DataFilter = "bans" | "priorities" | "contests" | null;

// Helper to get all champion IDs from an enemy team's pools (stored directly on team)
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

interface DraftChampionGridProps {
  unavailableChampions: Set<string>;
  selectedChampion: string | null;
  onSelectChampion: (championId: string) => void;
  isMyTurn: boolean;
  isBanPhase: boolean;
  // Draft data integration
  isLoggedIn: boolean;
  draftSessions: DraftSession[];
  linkedDraftSession: DraftSession | null;
  linkedDraftSessionId: string | null;
  onLinkDraftSession: (draftId: string | null) => void;
  contestedChampionIds: Set<string>;
}

export default function DraftChampionGrid({
  unavailableChampions,
  selectedChampion,
  onSelectChampion,
  isMyTurn,
  isBanPhase,
  isLoggedIn,
  draftSessions,
  linkedDraftSession,
  linkedDraftSessionId,
  onLinkDraftSession,
  contestedChampionIds,
}: DraftChampionGridProps) {
  const { champions, loading, searchChampions, getIconUrl } = useChampionData();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [activeDataFilter, setActiveDataFilter] = useState<DataFilter>(null);

  // Draft session selector state
  const [showDraftDropdown, setShowDraftDropdown] = useState(false);
  const [draftSearch, setDraftSearch] = useState("");

  // Pool filter state
  const myTeams = useMyTeamStore((s) => s.teams);
  const enemyTeams = useEnemyTeamStore((s) => s.teams);
  const playerPools = usePlayerPoolStore((s) => s.pools);
  const [selectedMyTeamIds, setSelectedMyTeamIds] = useState<string[]>([]);
  const [selectedEnemyTeamIds, setSelectedEnemyTeamIds] = useState<string[]>(
    [],
  );
  const [showPoolDropdown, setShowPoolDropdown] = useState(false);

  const hasPoolFilter =
    selectedMyTeamIds.length > 0 || selectedEnemyTeamIds.length > 0;

  // Get champion IDs from selected team pools
  const poolFilterChampionIds = useMemo(() => {
    const ids = new Set<string>();
    selectedMyTeamIds.forEach((teamId) => {
      const team = myTeams.find((t) => t.id === teamId);
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
    selectedEnemyTeamIds.forEach((teamId) => {
      const team = enemyTeams.find((t) => t.id === teamId);
      if (team) {
        getTeamChampionIds(team).forEach((id) => ids.add(id));
      }
    });
    return ids;
  }, [
    selectedMyTeamIds,
    selectedEnemyTeamIds,
    myTeams,
    enemyTeams,
    playerPools,
  ]);

  // Get groups for data filters
  const banGroups = useMemo(
    () => linkedDraftSession?.banGroups ?? [],
    [linkedDraftSession],
  );
  const priorityGroups = useMemo(
    () => linkedDraftSession?.priorityGroups ?? [],
    [linkedDraftSession],
  );

  // Count for badges
  const banCount = useMemo(
    () => banGroups.reduce((sum, g) => sum + g.championIds.length, 0),
    [banGroups],
  );
  const priorityCount = useMemo(
    () => priorityGroups.reduce((sum, g) => sum + g.championIds.length, 0),
    [priorityGroups],
  );
  const contestedCount = contestedChampionIds.size;

  // Get the groups to display based on active data filter
  const activeGroups: ChampionGroup[] | null = useMemo(() => {
    if (activeDataFilter === "bans") return banGroups;
    if (activeDataFilter === "priorities") return priorityGroups;
    if (activeDataFilter === "contests") {
      // Wrap contested champions in a single group
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
  }, [activeDataFilter, banGroups, priorityGroups, contestedChampionIds]);

  // Normal filtered champions (when no data filter active)
  const filteredChampions = useMemo((): {
    inPool: typeof champions;
    notInPool: typeof champions;
  } => {
    if (activeGroups !== null) return { inPool: [], notInPool: [] };
    let filtered = search ? searchChampions(search) : champions;

    if (roleFilter !== "all") {
      filtered = filtered.filter((c) => championPlaysRole(c.id, roleFilter));
    }

    // Remove unavailable champions (banned / fearless)
    filtered = filtered.filter((c) => !unavailableChampions.has(c.id));

    // Apply pool filter
    if (hasPoolFilter) {
      const inPool = filtered.filter((c) => poolFilterChampionIds.has(c.id));
      const notInPool = filtered.filter(
        (c) => !poolFilterChampionIds.has(c.id),
      );
      return {
        inPool: [...inPool].sort((a, b) => a.name.localeCompare(b.name)),
        notInPool: [...notInPool].sort((a, b) => a.name.localeCompare(b.name)),
      };
    }

    return {
      inPool: [...filtered].sort((a, b) => a.name.localeCompare(b.name)),
      notInPool: [],
    };
  }, [
    activeGroups,
    champions,
    search,
    searchChampions,
    roleFilter,
    unavailableChampions,
    hasPoolFilter,
    poolFilterChampionIds,
  ]);

  const toggleDataFilter = (filter: DataFilter) => {
    setActiveDataFilter((prev) => (prev === filter ? null : filter));
  };

  // Filtered draft sessions for dropdown
  const filteredDraftSessions = useMemo(() => {
    if (!draftSearch) return draftSessions;
    const q = draftSearch.toLowerCase();
    return draftSessions.filter((s) => s.name.toLowerCase().includes(q));
  }, [draftSessions, draftSearch]);

  // Champion icon renderer (shared between normal grid and grouped view)
  const renderChampionIcon = (championId: string) => {
    const isSelected = selectedChampion === championId;
    const isUnavailable = unavailableChampions.has(championId);
    const champion = champions.find((c) => c.id === championId);
    if (!champion) return null;

    return (
      <button
        key={championId}
        onClick={() => isMyTurn && !isUnavailable && onSelectChampion(championId)}
        disabled={!isMyTurn || isUnavailable}
        className={`relative group transition-all duration-150 w-14 h-14 shrink-0 ${isUnavailable ? 'cursor-not-allowed' : 'hover:scale-105'}`}
        title={champion.name}
      >
        <img
          src={getIconUrl(championId)}
          alt={champion.name}
          className={`w-14 h-14 rounded-md object-cover ${isUnavailable ? 'grayscale brightness-[0.35]' : 'brightness-110'}`}
          loading="lazy"
        />
        {isSelected && !isUnavailable && (
          <div className="absolute inset-0 rounded-md bg-yellow-800/40 pointer-events-none" />
        )}
        <div className="absolute bottom-0 left-0 right-0 bg-black/80 text-white text-[10px] text-center py-0.5 opacity-0 group-hover:opacity-100 transition-opacity truncate rounded-b-md">
          {champion.name}
        </div>
      </button>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-500">
        Loading champions...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full rounded-sm overflow-hidden">
      {/* Row 1: Draft Session Selector + Search + Pool Filter */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-lol-border bg-lol-card rounded-t-sm">
        {/* Draft Session Selector */}
        {isLoggedIn && (
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
              <span className="max-w-24 truncate">
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
                    {/* Unlink option */}
                    {linkedDraftSessionId && (
                      <button
                        onClick={() => {
                          onLinkDraftSession(null);
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
                        {draftSessions.length === 0
                          ? "No draft sessions found"
                          : "No matches"}
                      </div>
                    ) : (
                      filteredDraftSessions.map((ds) => (
                        <button
                          key={ds.id}
                          onClick={() => {
                            onLinkDraftSession(ds.id);
                            setShowDraftDropdown(false);
                          }}
                          className={`w-full px-3 py-2 text-xs text-left hover:bg-lol-surface transition-colors flex items-center gap-2 ${
                            ds.id === linkedDraftSessionId
                              ? "text-lol-gold bg-lol-gold/10"
                              : "text-gray-300"
                          }`}
                        >
                          <span className="flex-1 truncate">{ds.name}</span>
                          {ds.id === linkedDraftSessionId && (
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
        )}

        {/* Search */}
        <div className="relative flex-1 min-w-0">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search champions..."
            className="w-full px-3 py-1.5 bg-lol-dark rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-lol-gold/50"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
            >
              <svg
                className="w-4 h-4"
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
            </button>
          )}
        </div>

        {/* Pool Filter Dropdown */}
        {(myTeams.length > 0 || enemyTeams.length > 0) && (
          <div className="relative shrink-0">
            <button
              onClick={() => setShowPoolDropdown(!showPoolDropdown)}
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
                  {selectedMyTeamIds.length + selectedEnemyTeamIds.length}
                </span>
              )}
            </button>

            {showPoolDropdown && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowPoolDropdown(false)}
                />
                <div className="absolute top-full right-0 mt-1 z-20 min-w-56 bg-lol-card border border-lol-border rounded-lg shadow-xl overflow-hidden">
                  {/* My Teams */}
                  {myTeams.length > 0 && (
                    <div className="p-2">
                      <div className="text-[10px] text-gray-500 uppercase tracking-wide px-2 mb-1">
                        My Teams
                      </div>
                      {myTeams.map((team) => {
                        const isSelected = selectedMyTeamIds.includes(team.id);
                        const champCount = getMyTeamChampionCount(
                          team,
                          playerPools,
                        );
                        return (
                          <button
                            key={team.id}
                            onClick={() =>
                              setSelectedMyTeamIds((prev) =>
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
                  {myTeams.length > 0 && enemyTeams.length > 0 && (
                    <div className="border-t border-lol-border" />
                  )}
                  {/* Enemy Teams */}
                  {enemyTeams.length > 0 && (
                    <div className="p-2">
                      <div className="text-[10px] text-gray-500 uppercase tracking-wide px-2 mb-1">
                        Enemy Teams
                      </div>
                      {enemyTeams.map((team) => {
                        const isSelected = selectedEnemyTeamIds.includes(
                          team.id,
                        );
                        const champCount = getTeamChampionIds(team).size;
                        return (
                          <button
                            key={team.id}
                            onClick={() =>
                              setSelectedEnemyTeamIds((prev) =>
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
                            setSelectedMyTeamIds([]);
                            setSelectedEnemyTeamIds([]);
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

      {/* Row 2: Role Filters (left) + Data Filter Buttons (right) */}
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-b border-lol-border/50 bg-lol-card/50">
        {/* Role Filters */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setRoleFilter("all")}
            className={`
              px-2 py-1 text-xs font-medium rounded-lg transition-all
              ${
                roleFilter === "all"
                  ? "bg-lol-gold/20 text-lol-gold border border-lol-gold/50"
                  : "bg-lol-dark text-gray-400 border border-lol-border hover:text-white hover:border-lol-border-light"
              }
            `}
          >
            All
          </button>
          {ROLES.filter((r) => r.value !== "flex").map((role) => (
            <button
              key={role.value}
              onClick={() => setRoleFilter(role.value)}
              className={`
                p-1 rounded-lg transition-all
                ${
                  roleFilter === role.value
                    ? "bg-lol-gold/20 border border-lol-gold/50"
                    : "bg-lol-dark border border-lol-border hover:border-lol-border-light"
                }
              `}
              title={role.label}
            >
              <RoleIcon
                role={role.value}
                size="sm"
                className={
                  roleFilter === role.value
                    ? "brightness-125"
                    : "opacity-60 hover:opacity-100"
                }
              />
            </button>
          ))}
        </div>

        {/* Data Filter Buttons (only when a draft session is linked) */}
        {linkedDraftSession && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => toggleDataFilter("bans")}
              className={`
                flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-all
                ${
                  activeDataFilter === "bans"
                    ? "bg-red-500/20 text-red-400 border border-red-500/50"
                    : "bg-lol-dark text-gray-400 border border-lol-border hover:text-red-400 hover:border-red-500/30"
                }
              `}
            >
              Bans
              {banCount > 0 && (
                <span
                  className={`px-1 rounded text-[10px] ${activeDataFilter === "bans" ? "bg-red-500/30" : "bg-gray-600/50"}`}
                >
                  {banCount}
                </span>
              )}
            </button>
            <button
              onClick={() => toggleDataFilter("priorities")}
              className={`
                flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-all
                ${
                  activeDataFilter === "priorities"
                    ? "bg-lol-gold/20 text-lol-gold border border-lol-gold/50"
                    : "bg-lol-dark text-gray-400 border border-lol-border hover:text-lol-gold hover:border-lol-gold/30"
                }
              `}
            >
              Priorities
              {priorityCount > 0 && (
                <span
                  className={`px-1 rounded text-[10px] ${activeDataFilter === "priorities" ? "bg-lol-gold/30" : "bg-gray-600/50"}`}
                >
                  {priorityCount}
                </span>
              )}
            </button>
            {contestedCount > 0 && (
              <button
                onClick={() => toggleDataFilter("contests")}
                className={`
                  flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-all
                  ${
                    activeDataFilter === "contests"
                      ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/50"
                      : "bg-lol-dark text-gray-400 border border-lol-border hover:text-yellow-400 hover:border-yellow-500/30"
                  }
                `}
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
      </div>

      {/* Champion Grid / Grouped View */}
      <div className="flex-1 overflow-y-auto p-3 bg-lol-dark/50">
        {activeGroups !== null ? (
          /* Grouped view (data filter active) */
          <>
            {activeGroups.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
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
                  {/* Group header */}
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
                  {/* Group champions */}
                  <div className="flex flex-wrap gap-1.5">
                    {group.championIds.map((championId) =>
                      renderChampionIcon(championId),
                    )}
                  </div>
                </div>
              ))}
            </div>
            )}
          </>
        ) : (
          /* Normal grid */
          <>
            {filteredChampions.inPool.length === 0 &&
            filteredChampions.notInPool.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                No champions found
              </div>
            ) : (
              <>
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {/* Ban None option — first position during ban phase */}
                  {isBanPhase && isMyTurn && (
                    <button
                      onClick={() => onSelectChampion(NONE_CHAMPION)}
                      className={`
                        relative group transition-all duration-150 w-14 h-14 shrink-0 rounded-md
                        ${selectedChampion === NONE_CHAMPION
                          ? 'ring-2 ring-orange-500/70 bg-orange-500/10'
                          : 'hover:scale-105'
                        }
                      `}
                      title="No Ban"
                    >
                      <div className="w-14 h-14 rounded-md bg-lol-dark/80 flex items-center justify-center">
                        <svg className="w-9 h-9 text-gray-500" viewBox="0 0 130 142" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                          <path d="M1 95.5C20.2 125.5 36.3333 137.667 42 140C29.6 116.8 36.8333 92.6667 42 83.5C25.6 78.7 24.5 61.1667 26 53C58 60.6 58.6667 78.8333 55 87C56.6 96.6 62.6667 104 65.5 106.5C72.7 97.7 74.8333 89.8333 75 87C68.2 64.6 91.8333 55 104.5 53C106.5 71.8 94.6667 81.1667 88.5 83.5C100.1 103.9 93.3333 129.667 88.5 140C107.7 127.2 123.5 105 129 95.5C108.2 79.9 111.333 48.3333 115.5 34.5C101.9 18.9 75.8333 5.66667 64.5 1C40.5 10.2 20.8333 27.1667 14 34.5C23.6 72.1 9.33333 90.8333 1 95.5Z" />
                        </svg>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 bg-black/80 text-gray-400 text-[10px] text-center py-0.5 opacity-0 group-hover:opacity-100 transition-opacity rounded-b-md">
                        No Ban
                      </div>
                    </button>
                  )}
                  {filteredChampions.inPool.map((champion) =>
                    renderChampionIcon(champion.id),
                  )}
                </div>
                {hasPoolFilter && filteredChampions.notInPool.length > 0 && (
                  <>
                    <div className="flex items-center gap-3 my-3">
                      <div className="flex-1 h-px bg-lol-border" />
                      <span className="text-[10px] text-gray-500 uppercase tracking-wide">
                        Not in pools
                      </span>
                      <div className="flex-1 h-px bg-lol-border" />
                    </div>
                    <div className="flex flex-wrap gap-1.5 justify-center opacity-60">
                      {filteredChampions.notInPool.map((champion) =>
                        renderChampionIcon(champion.id),
                      )}
                    </div>
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
