import { useState, useEffect } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { useEnemyTeamStore } from "../stores/useEnemyTeamStore";
import { useRankStore } from "../stores/useRankStore";
import { useMasteryStore } from "../stores/useMasteryStore";
import { parseOpggMultiSearchUrl, ROLES, Role, Player } from "../types";
import { Button, Card, Input, Modal } from "../components/ui";
import { RoleSlot, SubSlot, RoleIcon } from "../components/team";
import { useOpgg } from "../hooks/useOpgg";
import { PlayerTierList } from "../components/champion";

function SubsDropZone({
  children,
  teamId,
}: {
  children: React.ReactNode;
  teamId: string;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `subs-drop-zone-${teamId}`,
    data: { type: "subs", teamId },
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex gap-3 flex-wrap min-h-20 p-2 rounded-xl transition-all duration-200 ${
        isOver ? "bg-lol-gold/10 ring-2 ring-lol-gold/50" : "bg-lol-dark/50"
      }`}
    >
      {children}
    </div>
  );
}

export default function EnemyTeamPage() {
  const {
    teams,
    addTeam,
    importTeamFromOpgg,
    importPlayersToTeam,
    updateTeam,
    deleteTeam,
    updatePlayer,
    addSub,
    removeSub,
    swapPlayerRoles,
    moveToRole,
    moveToSubs,
    addChampionToGroup,
    removeChampionFromGroup,
    moveChampion,
    reorderChampionInGroup,
    addGroup,
    removeGroup,
    renameGroup,
    reorderGroups,
    setAllowDuplicateChampions,
    toggleFavorite,
    addNote,
    updateNote,
    deleteNote,
    addPlayerNote,
    updatePlayerNote,
    deletePlayerNote,
  } = useEnemyTeamStore();
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<
    Record<string, string>
  >({});
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [importUrl, setImportUrl] = useState("");
  const [importTeamName, setImportTeamName] = useState("");
  const [importError, setImportError] = useState("");
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
  const [activePlayer, setActivePlayer] = useState<Player | null>(null);
  const [inlineImportUrl, setInlineImportUrl] = useState<
    Record<string, string>
  >({});
  const [inlineImportError, setInlineImportError] = useState<
    Record<string, string>
  >({});
  const [activeDragTeamId, setActiveDragTeamId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  const {
    fetchRanksForContext,
    fetchRanksFromCache,
    isFetchingContext,
    isConfigured: isRankApiConfigured,
    allPlayersUpdated,
    somePlayersNeedUpdate,
  } = useRankStore();

  const {
    fetchMasteriesFromCache,
    fetchMasteriesForPlayers,
  } = useMasteryStore();

  const { openMultiSearch } = useOpgg();

  // Auto-fetch ranks and masteries from cache on page load
  useEffect(() => {
    if (!isRankApiConfigured()) return;

    // Collect all players from all teams
    const allPlayers = teams.flatMap((team) =>
      team.players
        .filter((p) => p.summonerName && p.tagLine)
        .map((p) => ({
          summonerName: p.summonerName,
          tagLine: p.tagLine,
          region: p.region,
        })),
    );

    if (allPlayers.length > 0) {
      fetchRanksFromCache(allPlayers);
      fetchMasteriesFromCache(allPlayers);
    }
  }, [teams, fetchRanksFromCache, fetchMasteriesFromCache, isRankApiConfigured]);

  const handleFetchRanksForTeam = async (teamId: string) => {
    const team = teams.find((t) => t.id === teamId);
    if (!team) return;
    const playersWithNames = team.players.filter(
      (p) => p.summonerName && p.tagLine,
    );
    // Fetch both ranks and masteries
    await Promise.all([
      fetchRanksForContext(teamId, playersWithNames),
      fetchMasteriesForPlayers(playersWithNames),
    ]);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const handleDragStart = (
    event: DragStartEvent,
    teamId: string,
    players: Player[],
  ) => {
    const { active } = event;
    const player = players.find((p) => p.id === active.id);
    setActivePlayer(player || null);
    setActiveDragTeamId(teamId);
  };

  const handleDragEnd = (
    event: DragEndEvent,
    teamId: string,
    players: Player[],
  ) => {
    const { active, over } = event;
    setActivePlayer(null);
    setActiveDragTeamId(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Check if dropping on another player first (for swapping)
    if (activeId !== overId) {
      const draggedPlayer = players.find((p) => p.id === activeId);
      const targetPlayer = players.find((p) => p.id === overId);

      if (draggedPlayer && targetPlayer) {
        swapPlayerRoles(teamId, activeId, overId);
        return;
      }
    }

    if (overId.startsWith("role-")) {
      const role = overId.replace("role-", "") as Role;
      moveToRole(teamId, activeId, role);
      return;
    }

    if (overId === `subs-drop-zone-${teamId}`) {
      moveToSubs(teamId, activeId);
      return;
    }
  };

  const handleAddTeam = () => {
    if (newTeamName.trim()) {
      const team = addTeam(newTeamName.trim());
      setNewTeamName("");
      setIsAddModalOpen(false);
      setExpandedTeamId(team.id);
    }
  };

  const handleImport = () => {
    setImportError("");
    const parsed = parseOpggMultiSearchUrl(importUrl);

    if (!parsed) {
      setImportError(
        "Invalid OP.GG multi-search URL. Make sure it looks like: https://www.op.gg/multisearch/euw?summoners=...",
      );
      return;
    }

    if (parsed.players.length === 0) {
      setImportError("No players found in URL");
      return;
    }

    const teamName =
      importTeamName.trim() || `Imported Team ${teams.length + 1}`;
    const team = importTeamFromOpgg(teamName, parsed.region, parsed.players);

    setImportUrl("");
    setImportTeamName("");
    setIsImportModalOpen(false);
    setExpandedTeamId(team.id);
  };

  const handleInlineImport = (teamId: string) => {
    const url = inlineImportUrl[teamId] || "";
    setInlineImportError((prev) => ({ ...prev, [teamId]: "" }));

    const parsed = parseOpggMultiSearchUrl(url);

    if (!parsed) {
      setInlineImportError((prev) => ({
        ...prev,
        [teamId]:
          "Invalid OP.GG URL. Use format: https://www.op.gg/multisearch/euw?summoners=...",
      }));
      return;
    }

    if (parsed.players.length === 0) {
      setInlineImportError((prev) => ({
        ...prev,
        [teamId]: "No players found in URL",
      }));
      return;
    }

    importPlayersToTeam(teamId, parsed.region, parsed.players);
    setInlineImportUrl((prev) => ({ ...prev, [teamId]: "" }));
  };

  const handleDeleteTeam = (id: string) => {
    if (confirm("Are you sure you want to delete this team?")) {
      deleteTeam(id);
      if (expandedTeamId === id) {
        setExpandedTeamId(null);
      }
    }
  };

  const toggleExpanded = (id: string) => {
    setExpandedTeamId(expandedTeamId === id ? null : id);
  };

  const getMainRoster = (players: (typeof teams)[0]["players"]) =>
    players.filter((p) => !p.isSub);

  const getSubs = (players: (typeof teams)[0]["players"]) =>
    players.filter((p) => p.isSub);

  const filteredTeams = teams.filter((team) => {
    // Search filter - match team name or player names
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      team.name.toLowerCase().includes(searchLower) ||
      team.players.some((p) =>
        p.summonerName?.toLowerCase().includes(searchLower),
      );

    if (!matchesSearch) return false;

    // Favorites filter
    if (showFavoritesOnly && !team.isFavorite) return false;

    return true;
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Enemy Teams</h1>
          <p className="text-gray-400 mt-1">Scout and track your opponents</p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="secondary"
            onClick={() => setIsImportModalOpen(true)}
          >
            Import from OP.GG
          </Button>
          <Button onClick={() => setIsAddModalOpen(true)}>+ Add Team</Button>
        </div>
      </div>

      {/* Search and Filter Bar */}
      {teams.length > 0 && (
        <div className="flex gap-3 items-center">
          <div className="relative flex-1 max-w-md">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search teams or players..."
              className="w-full pl-10 pr-4 py-2.5 bg-lol-dark border border-lol-border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-lol-gold/50 focus:ring-2 focus:ring-lol-gold/20 transition-all duration-200"
            />
          </div>
          <button
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all duration-200 ${
              showFavoritesOnly
                ? "bg-lol-gold/20 border-lol-gold text-lol-gold"
                : "bg-lol-dark border-lol-border text-gray-400 hover:text-white hover:border-gray-500"
            }`}
          >
            <svg
              className="w-4 h-4"
              fill={showFavoritesOnly ? "currentColor" : "none"}
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
              />
            </svg>
            Favorites
          </button>
          {(searchQuery || showFavoritesOnly) && (
            <button
              onClick={() => {
                setSearchQuery("");
                setShowFavoritesOnly(false);
              }}
              className="px-3 py-2.5 text-gray-400 hover:text-white transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {teams.length === 0 ? (
        <Card className="text-center py-12">
          <div className="text-gray-500 mb-2">
            <svg
              className="w-12 h-12 mx-auto"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          </div>
          <p className="text-gray-400 mb-6">No enemy teams added yet</p>
          <div className="flex gap-3 justify-center">
            <Button
              variant="secondary"
              onClick={() => setIsImportModalOpen(true)}
            >
              Import from OP.GG
            </Button>
            <Button onClick={() => setIsAddModalOpen(true)}>
              Add Manually
            </Button>
          </div>
        </Card>
      ) : filteredTeams.length === 0 ? (
        <Card className="text-center py-8">
          <p className="text-gray-400">
            No teams match your search
            {showFavoritesOnly ? " or favorites filter" : ""}.
          </p>
          <button
            onClick={() => {
              setSearchQuery("");
              setShowFavoritesOnly(false);
            }}
            className="mt-3 text-lol-gold hover:text-lol-gold-light transition-colors"
          >
            Clear filters
          </button>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredTeams.map((team) => {
            const mainRoster = getMainRoster(team.players);
            const subs = getSubs(team.players);
            const filledPlayers = team.players.filter(
              (p) => p.summonerName,
            ).length;
            const isExpanded = expandedTeamId === team.id;

            return (
              <Card key={team.id} variant="bordered" padding="lg">
                <div className="flex items-center justify-between">
                  <div
                    className="flex-1 cursor-pointer"
                    onClick={() => toggleExpanded(team.id)}
                  >
                    <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                      {team.name}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(team.id);
                        }}
                        className={`transition-colors ${team.isFavorite ? "text-lol-gold" : "text-gray-600 hover:text-gray-400"}`}
                      >
                        <svg
                          className="w-4 h-4"
                          fill={team.isFavorite ? "currentColor" : "none"}
                          stroke="currentColor"
                          strokeWidth={2}
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                          />
                        </svg>
                      </button>
                    </h2>
                    <p className="text-sm text-gray-400 mt-1">
                      {filledPlayers} players (
                      {mainRoster.filter((p) => p.summonerName).length} main
                      {subs.length > 0 &&
                        `, ${subs.filter((p) => p.summonerName).length} subs`}
                      )
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {/* Expand/collapse button */}
                    <button
                      onClick={() => toggleExpanded(team.id)}
                      className={`p-2 rounded-lg transition-all duration-200 ${isExpanded ? "bg-lol-gold/20 text-lol-gold" : "text-gray-500 hover:text-white"}`}
                    >
                      <svg
                        className={`w-5 h-5 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
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
                    {/* Three-dot menu */}
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(
                            openMenuId === team.id ? null : team.id,
                          );
                        }}
                        className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-lol-surface transition-all duration-200"
                      >
                        <svg
                          className="w-5 h-5"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <circle cx="12" cy="5" r="2" />
                          <circle cx="12" cy="12" r="2" />
                          <circle cx="12" cy="19" r="2" />
                        </svg>
                      </button>
                      {openMenuId === team.id && (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setOpenMenuId(null)}
                          />
                          <div className="absolute right-0 top-full mt-1 z-20 bg-lol-card border border-lol-border rounded-lg shadow-xl min-w-40 py-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuId(null);
                                toggleFavorite(team.id);
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-lol-surface transition-colors flex items-center gap-2"
                            >
                              <svg
                                className="w-4 h-4"
                                fill={team.isFavorite ? "currentColor" : "none"}
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                                />
                              </svg>
                              {team.isFavorite
                                ? "Remove Favorite"
                                : "Add to Favorites"}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuId(null);
                                handleDeleteTeam(team.id);
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                            >
                              Delete Team
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-6 pt-6 border-t border-lol-border space-y-6">
                    {/* Team Name, Import, and Actions Row */}
                    <div className="flex gap-4 items-end">
                      <div className="w-48">
                        <Input
                          label="Team Name"
                          value={team.name}
                          onChange={(e) =>
                            updateTeam(team.id, { name: e.target.value })
                          }
                        />
                      </div>
                      {(() => {
                        const validPlayers = team.players.filter(
                          (p) => p.summonerName,
                        );
                        const teamRegion = team.players[0]?.region || "euw";
                        if (validPlayers.length <= 1) return null;
                        return (
                          <Button
                            variant="secondary"
                            onClick={() =>
                              openMultiSearch(team.players, teamRegion)
                            }
                          >
                            Multi-OP.GG Search
                          </Button>
                        );
                      })()}
                      {isRankApiConfigured() &&
                        (() => {
                          const teamPlayers = team.players
                            .filter((p) => p.summonerName && p.tagLine)
                            .map((p) => ({
                              summonerName: p.summonerName,
                              tagLine: p.tagLine,
                              region: p.region,
                            }));
                          const isUpdated = allPlayersUpdated(teamPlayers);
                          const needsUpdate =
                            somePlayersNeedUpdate(teamPlayers);
                          const isFetching = isFetchingContext(team.id);
                          if (teamPlayers.length === 0) return null;

                          return (
                            <Button
                              variant="ghost"
                              onClick={() => handleFetchRanksForTeam(team.id)}
                              disabled={isFetching || !needsUpdate}
                              title={
                                isUpdated
                                  ? "All players have been updated within the last 24 hours"
                                  : "Fetch player ranks from Riot API"
                              }
                            >
                              {isFetching
                                ? "Fetching Ranks..."
                                : isUpdated
                                  ? "Ranks Updated"
                                  : "Update Ranks"}
                            </Button>
                          );
                        })()}
                      <div className="ml-auto w-96">
                        <label className="block text-sm font-medium text-gray-300 mb-2 text-end">
                          Import players from OP.GG
                        </label>
                        <div className="flex gap-2 justify-end">
                          <Input
                            value={inlineImportUrl[team.id] || ""}
                            onChange={(e) => {
                              setInlineImportUrl((prev) => ({
                                ...prev,
                                [team.id]: e.target.value,
                              }));
                              setInlineImportError((prev) => ({
                                ...prev,
                                [team.id]: "",
                              }));
                            }}
                            placeholder="Paste OP.GG multi-search URL..."
                            className="flex-1"
                          />
                          <Button
                            onClick={() => handleInlineImport(team.id)}
                            disabled={!inlineImportUrl[team.id]?.trim()}
                          >
                            Import
                          </Button>
                        </div>
                      </div>
                    </div>
                    {inlineImportError[team.id] && (
                      <p className="text-sm text-red-400 -mt-4">
                        {inlineImportError[team.id]}
                      </p>
                    )}

                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCorners}
                      onDragStart={(e) =>
                        handleDragStart(e, team.id, team.players)
                      }
                      onDragEnd={(e) => handleDragEnd(e, team.id, team.players)}
                    >
                      {/* Main Roster */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-medium text-gray-300">
                            Main Roster
                          </h3>
                          <p className="text-xs text-gray-500">
                            Drag players to swap roles
                          </p>
                        </div>
                        <SortableContext
                          items={mainRoster.map((p) => p.id)}
                          strategy={horizontalListSortingStrategy}
                        >
                          <div className="flex gap-3 p-2 rounded-xl bg-lol-dark/50">
                            {ROLES.map((role) => {
                              const player = mainRoster.find(
                                (p) => p.role === role.value,
                              );
                              return (
                                <RoleSlot
                                  key={role.value}
                                  role={role.value as Role}
                                  player={player}
                                  onPlayerChange={(playerId, updates) =>
                                    updatePlayer(team.id, playerId, updates)
                                  }
                                />
                              );
                            })}
                          </div>
                        </SortableContext>
                      </div>

                      {/* Subs Section */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-medium text-gray-300">
                            Substitutes
                          </h3>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => addSub(team.id)}
                          >
                            + Add Sub
                          </Button>
                        </div>
                        <SortableContext items={subs.map((p) => p.id)}>
                          <SubsDropZone teamId={team.id}>
                            {subs.length === 0 ? (
                              <p className="text-sm text-gray-500 p-4 w-full text-center">
                                No subs - drag a player here or click Add Sub
                              </p>
                            ) : (
                              subs.map((sub) => (
                                <SubSlot
                                  key={sub.id}
                                  player={sub}
                                  onPlayerChange={(playerId, updates) =>
                                    updatePlayer(team.id, playerId, updates)
                                  }
                                  onRemove={() => removeSub(team.id, sub.id)}
                                />
                              ))
                            )}
                          </SubsDropZone>
                        </SortableContext>
                      </div>

                      {/* Drag Overlay */}
                      <DragOverlay>
                        {activePlayer && activeDragTeamId === team.id ? (
                          <div className="bg-lol-card border border-lol-gold rounded-xl px-4 py-3 shadow-xl shadow-lol-gold/20">
                            <div className="font-semibold text-lol-gold text-sm">
                              {
                                ROLES.find((r) => r.value === activePlayer.role)
                                  ?.label
                              }
                            </div>
                            <div className="text-white font-medium mt-1">
                              {activePlayer.summonerName || "Empty"}
                            </div>
                            <div className="text-gray-400 text-xs mt-0.5">
                              #{activePlayer.tagLine}
                            </div>
                          </div>
                        ) : null}
                      </DragOverlay>
                    </DndContext>

                    {/* Notepad */}
                    <div>
                      <h3 className="text-sm font-medium text-gray-300 mb-3">
                        Team Notes
                      </h3>
                      <div className="flex flex-wrap gap-3">
                        {(team.notepad || []).map((note) => (
                          <div
                            key={note.id}
                            className="relative group w-[calc((100%-3rem)/5)] min-w-36 h-38 bg-lol-dark rounded-xl border border-lol-border/50 p-3 hover:border-lol-border-light transition-all duration-200"
                          >
                            <button
                              onClick={() => deleteNote(team.id, note.id)}
                              className="absolute -top-2 -right-2 w-5 h-5 bg-red-500/80 hover:bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center z-10"
                            >
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                            <textarea
                              value={note.content}
                              onChange={(e) => updateNote(team.id, note.id, e.target.value)}
                              placeholder="Add note..."
                              className="w-full h-full bg-transparent text-white text-sm placeholder-gray-600 resize-none focus:outline-none"
                            />
                          </div>
                        ))}
                        {/* Add Note Placeholder */}
                        <button
                          onClick={() => addNote(team.id)}
                          className="w-[calc((100%-3rem)/5)] min-w-36 h-38 bg-lol-card/50 rounded-xl border border-dashed border-lol-border/50 hover:border-lol-gold/50 hover:bg-lol-card transition-all duration-200 flex flex-col items-center justify-center gap-2 text-gray-500 hover:text-lol-gold"
                        >
                          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                          </svg>
                          <span className="text-sm">Add Note</span>
                        </button>
                      </div>
                    </div>

                    {/* Player Champion Pools */}
                    <div>
                      <div className="mb-4">
                        <h3 className="text-sm font-medium text-gray-300">
                          Player Champion Pools
                        </h3>
                        <p className="text-xs text-gray-400 font-light">
                          Create custom champion pools for each player. Data is
                          used in drafting.
                        </p>
                      </div>

                      {/* Player Tabs - Main Roster */}
                      <div className="flex flex-wrap gap-2 mb-4">
                        <div className="flex gap-2 bg-lol-dark p-1.5 rounded-xl border border-lol-border">
                          {ROLES.map((role) => {
                            const player = mainRoster.find(
                              (p) => p.role === role.value,
                            );
                            if (!player) return null;
                            const roleLabel = role.label;
                            const selectedId =
                              selectedPlayerIds[team.id] ||
                              mainRoster.find((p) => p.role === "top")?.id ||
                              mainRoster[0]?.id;
                            const isSelected = player.id === selectedId;
                            return (
                              <button
                                key={player.id}
                                onClick={() =>
                                  setSelectedPlayerIds((prev) => ({
                                    ...prev,
                                    [team.id]: player.id,
                                  }))
                                }
                                className={`px-4 py-2.5 rounded-lg font-medium transition-all duration-200 min-w-35 text-center ${
                                  isSelected
                                    ? "bg-gradient-to-b from-lol-gold-light to-lol-gold text-lol-dark shadow-md"
                                    : "text-gray-400 hover:text-white hover:bg-lol-surface"
                                }`}
                              >
                                <div className="text-sm flex items-center justify-center gap-1">
                                  <RoleIcon role={role.value} size="xs" />
                                  {roleLabel}
                                </div>
                                <div
                                  className={`text-xs mt-0.5 truncate ${isSelected ? "text-lol-dark/70" : "text-gray-500"}`}
                                >
                                  {player.summonerName || "Empty"}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                        {/* Subs Tabs */}
                        {subs.length > 0 && (
                          <div className="flex gap-2 bg-lol-dark p-1.5 rounded-xl border border-lol-border/50">
                            {subs.map((player) => {
                              const selectedId =
                                selectedPlayerIds[team.id] ||
                                mainRoster.find((p) => p.role === "top")?.id ||
                                mainRoster[0]?.id;
                              const isSelected = player.id === selectedId;
                              return (
                                <button
                                  key={player.id}
                                  onClick={() =>
                                    setSelectedPlayerIds((prev) => ({
                                      ...prev,
                                      [team.id]: player.id,
                                    }))
                                  }
                                  className={`px-4 py-2.5 rounded-lg font-medium transition-all duration-200 min-w-35 text-center ${
                                    isSelected
                                      ? "bg-gradient-to-b from-lol-gold-light to-lol-gold text-lol-dark shadow-md"
                                      : "text-gray-400 hover:text-white hover:bg-lol-surface"
                                  }`}
                                >
                                  <div className="text-sm text-orange-400 flex items-center justify-center gap-1">
                                    <RoleIcon role={player.role} size="xs" />
                                    Sub
                                  </div>
                                  <div
                                    className={`text-xs mt-0.5 truncate ${isSelected ? "text-lol-dark/70" : "text-gray-500"}`}
                                  >
                                    {player.summonerName || "Empty"}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Selected Player's Champion Groups */}
                      {(() => {
                        const selectedId =
                          selectedPlayerIds[team.id] ||
                          mainRoster.find((p) => p.role === "top")?.id ||
                          mainRoster[0]?.id;
                        const selectedPlayer = team.players.find(
                          (p) => p.id === selectedId,
                        );
                        if (!selectedPlayer) return null;
                        return (
                          <PlayerTierList
                            player={selectedPlayer}
                            onAddChampion={(groupId, championId) =>
                              addChampionToGroup(
                                team.id,
                                selectedPlayer.id,
                                groupId,
                                championId,
                              )
                            }
                            onRemoveChampion={(groupId, championId) =>
                              removeChampionFromGroup(
                                team.id,
                                selectedPlayer.id,
                                groupId,
                                championId,
                              )
                            }
                            onMoveChampion={(
                              fromGroupId,
                              toGroupId,
                              championId,
                              newIndex,
                            ) =>
                              moveChampion(
                                team.id,
                                selectedPlayer.id,
                                fromGroupId,
                                toGroupId,
                                championId,
                                newIndex,
                              )
                            }
                            onReorderChampion={(
                              groupId,
                              championId,
                              newIndex,
                            ) =>
                              reorderChampionInGroup(
                                team.id,
                                selectedPlayer.id,
                                groupId,
                                championId,
                                newIndex,
                              )
                            }
                            onAddGroup={(groupName) =>
                              addGroup(team.id, selectedPlayer.id, groupName)
                            }
                            onRemoveGroup={(groupId) =>
                              removeGroup(team.id, selectedPlayer.id, groupId)
                            }
                            onRenameGroup={(groupId, newName) =>
                              renameGroup(
                                team.id,
                                selectedPlayer.id,
                                groupId,
                                newName,
                              )
                            }
                            onReorderGroups={(groupIds) =>
                              reorderGroups(
                                team.id,
                                selectedPlayer.id,
                                groupIds,
                              )
                            }
                            onSetAllowDuplicates={(allowDuplicates) =>
                              setAllowDuplicateChampions(
                                team.id,
                                selectedPlayer.id,
                                allowDuplicates,
                              )
                            }
                            onAddNote={() =>
                              addPlayerNote(team.id, selectedPlayer.id)
                            }
                            onUpdateNote={(noteId, content) =>
                              updatePlayerNote(team.id, selectedPlayer.id, noteId, content)
                            }
                            onDeleteNote={(noteId) =>
                              deletePlayerNote(team.id, selectedPlayer.id, noteId)
                            }
                          />
                        );
                      })()}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Team Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Enemy Team"
      >
        <div className="space-y-6">
          <Input
            label="Team Name"
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            placeholder="e.g., Team Liquid"
            autoFocus
            size="lg"
          />
          <div className="flex gap-3 justify-end">
            <Button variant="ghost" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddTeam} disabled={!newTeamName.trim()}>
              Add Team
            </Button>
          </div>
        </div>
      </Modal>

      {/* Import Modal */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => {
          setIsImportModalOpen(false);
          setImportError("");
          setImportUrl("");
          setImportTeamName("");
        }}
        title="Import from OP.GG"
      >
        <div className="space-y-5">
          <p className="text-sm text-gray-400 bg-lol-dark rounded-lg p-4 border border-lol-border">
            Paste an OP.GG multi-search URL to automatically import player
            names.
          </p>
          <Input
            label="OP.GG Multi-Search URL"
            value={importUrl}
            onChange={(e) => {
              setImportUrl(e.target.value);
              setImportError("");
            }}
            placeholder="https://www.op.gg/multisearch/euw?summoners=..."
            autoFocus
          />
          <Input
            label="Team Name (optional)"
            value={importTeamName}
            onChange={(e) => setImportTeamName(e.target.value)}
            placeholder="e.g., Week 3 Opponent"
          />
          {importError && (
            <p className="text-sm text-red-400 bg-red-500/10 rounded-lg p-3 border border-red-500/20">
              {importError}
            </p>
          )}
          <div className="flex gap-3 justify-end pt-2">
            <Button
              variant="ghost"
              onClick={() => {
                setIsImportModalOpen(false);
                setImportError("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={!importUrl.trim()}>
              Import
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
