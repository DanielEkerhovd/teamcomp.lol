import { useState, useMemo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { useChampionData } from '../../hooks/useChampionData';
import { getChampionRoles } from '../../data/championRoles';
import { Role, Team } from '../../types';
import DraggableChampion from './DraggableChampion';
import { useMyTeamStore } from '../../stores/useMyTeamStore';
import { useEnemyTeamStore } from '../../stores/useEnemyTeamStore';
import { usePlayerPoolStore } from '../../stores/usePlayerPoolStore';

interface DraftChampionPoolProps {
  usedChampionIds: string[];
}

// Helper to get all champion IDs from an enemy team's pools (stored directly on team)
const getTeamChampionIds = (team: Team): Set<string> => {
  const ids = new Set<string>();
  team.players.forEach((player) => {
    // From championPool (tiered)
    player.championPool?.forEach((c) => ids.add(c.championId));
    // From championGroups
    player.championGroups?.forEach((group) => {
      group.championIds.forEach((id) => ids.add(id));
    });
  });
  return ids;
};

// Helper to get champion count for my team (uses playerPools)
const getMyTeamChampionCount = (team: Team, playerPools: { summonerName: string; role: string; championGroups?: { championIds: string[] }[] }[]): number => {
  const ids = new Set<string>();
  team.players.forEach((player) => {
    if (player.summonerName) {
      const playerPool = playerPools.find(
        (p) => p.summonerName.toLowerCase() === player.summonerName.toLowerCase() && p.role === player.role
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

const ROLE_ICON_URLS: Record<Role, string> = {
  top: "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-top.png",
  jungle: "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-jungle.png",
  mid: "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-middle.png",
  adc: "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-bottom.png",
  support: "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-utility.png",
  flex: "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-fill.png",
};

const ROLES: Role[] = ['top', 'jungle', 'mid', 'adc', 'support'];

export default function DraftChampionPool({ usedChampionIds }: DraftChampionPoolProps) {
  const { champions, searchChampions, loading } = useChampionData();
  const [search, setSearch] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<Role[]>([]);

  // Team pool filtering
  const myTeams = useMyTeamStore((s) => s.teams);
  const enemyTeams = useEnemyTeamStore((s) => s.teams);
  const playerPools = usePlayerPoolStore((s) => s.pools);

  const [selectedMyTeamIds, setSelectedMyTeamIds] = useState<string[]>([]);
  const [selectedEnemyTeamIds, setSelectedEnemyTeamIds] = useState<string[]>([]);
  const [showPoolDropdown, setShowPoolDropdown] = useState(false);

  // Get champion IDs from selected team pools
  const poolFilterChampionIds = useMemo(() => {
    const ids = new Set<string>();

    // Add champions from selected my teams (uses playerPools store)
    selectedMyTeamIds.forEach((teamId) => {
      const team = myTeams.find((t) => t.id === teamId);
      if (team) {
        team.players.forEach((player) => {
          if (player.summonerName) {
            // Find the player's pool in playerPools store
            const playerPool = playerPools.find(
              (p) => p.summonerName.toLowerCase() === player.summonerName.toLowerCase() && p.role === player.role
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

    // Add champions from selected enemy teams (stored directly on team)
    selectedEnemyTeamIds.forEach((teamId) => {
      const team = enemyTeams.find((t) => t.id === teamId);
      if (team) {
        getTeamChampionIds(team).forEach((id) => ids.add(id));
      }
    });

    return ids;
  }, [selectedMyTeamIds, selectedEnemyTeamIds, myTeams, enemyTeams, playerPools]);

  const hasPoolFilter = selectedMyTeamIds.length > 0 || selectedEnemyTeamIds.length > 0;

  const toggleMyTeam = (teamId: string) => {
    setSelectedMyTeamIds((prev) =>
      prev.includes(teamId) ? prev.filter((id) => id !== teamId) : [...prev, teamId]
    );
  };

  const toggleEnemyTeam = (teamId: string) => {
    setSelectedEnemyTeamIds((prev) =>
      prev.includes(teamId) ? prev.filter((id) => id !== teamId) : [...prev, teamId]
    );
  };

  const { setNodeRef, isOver } = useDroppable({
    id: 'pool',
  });

  const { inPoolChampions, notInPoolChampions } = useMemo(() => {
    let result = search ? searchChampions(search) : champions;

    // Filter out used champions
    result = result.filter((c) => !usedChampionIds.includes(c.id));

    // Filter by selected roles
    if (selectedRoles.length > 0) {
      result = result.filter((c) => {
        const champRoles = getChampionRoles(c.id);
        return selectedRoles.some((role) => champRoles.includes(role));
      });
    }

    // Sort alphabetically
    const sorted = [...result].sort((a, b) => a.name.localeCompare(b.name));

    // Split into in-pool and not-in-pool when filter is active
    if (hasPoolFilter) {
      return {
        inPoolChampions: sorted.filter((c) => poolFilterChampionIds.has(c.id)),
        notInPoolChampions: sorted.filter((c) => !poolFilterChampionIds.has(c.id)),
      };
    }

    return { inPoolChampions: sorted, notInPoolChampions: [] };
  }, [champions, search, searchChampions, selectedRoles, usedChampionIds, hasPoolFilter, poolFilterChampionIds]);

  const selectRole = (role: Role | null) => {
    if (role === null) {
      setSelectedRoles([]);
    } else {
      setSelectedRoles([role]);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading champions...</div>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      className={`
        flex flex-col h-full min-h-0 bg-lol-card rounded-lg border border-lol-border p-4
        ${isOver ? 'border-lol-gold' : ''}
      `}
    >
      {/* Search */}
      <div className="mb-3 shrink-0">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search champions..."
          className="w-full px-3 py-2 bg-lol-dark border border-lol-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-lol-gold"
        />
      </div>

      {/* Role filters and Pool filter */}
      <div className="flex items-center gap-2 mb-3 shrink-0">
        {/* Role filters */}
        <div className="flex gap-1 flex-wrap">
          <button
            onClick={() => selectRole(null)}
            className={`
              px-2 py-1.5 rounded-md transition-colors text-xs font-medium
              ${
                selectedRoles.length === 0
                  ? 'bg-lol-gold/20 ring-1 ring-lol-gold text-lol-gold'
                  : 'bg-lol-dark hover:bg-lol-surface text-gray-400'
              }
            `}
            title="All Champions"
          >
            All
          </button>
          {ROLES.map((role) => (
            <button
              key={role}
              onClick={() => selectRole(role)}
              className={`
                p-1.5 rounded-md transition-colors
                ${
                  selectedRoles.length === 1 && selectedRoles[0] === role
                    ? 'bg-lol-gold/20 ring-1 ring-lol-gold'
                    : 'bg-lol-dark hover:bg-lol-surface'
                }
              `}
              title={role.charAt(0).toUpperCase() + role.slice(1)}
            >
              <img
                src={ROLE_ICON_URLS[role]}
                alt={role}
                className="w-5 h-5 object-contain"
              />
            </button>
          ))}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Team Pool Filter Dropdown */}
        {(myTeams.length > 0 || enemyTeams.length > 0) && (
          <div className="relative">
            <button
              onClick={() => setShowPoolDropdown(!showPoolDropdown)}
              className={`
                flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                ${
                  hasPoolFilter
                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/50'
                    : 'bg-lol-dark text-gray-400 border border-lol-border hover:text-gray-300 hover:border-lol-border-light'
                }
              `}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              <span>Pools</span>
              {hasPoolFilter && (
                <span className="bg-purple-500/30 px-1.5 py-0.5 rounded text-xs">
                  {selectedMyTeamIds.length + selectedEnemyTeamIds.length}
                </span>
              )}
              <svg
                className={`w-4 h-4 transition-transform ${showPoolDropdown ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showPoolDropdown && (
              <>
                {/* Backdrop */}
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowPoolDropdown(false)}
                />

                {/* Dropdown */}
                <div className="absolute top-full right-0 mt-1 z-20 min-w-56 bg-lol-card border border-lol-border rounded-lg shadow-xl overflow-hidden">
                  {/* My Teams Section */}
                  {myTeams.length > 0 && (
                    <div className="p-2">
                      <div className="text-xs text-gray-500 uppercase tracking-wide px-2 mb-1">My Teams</div>
                      {myTeams.map((team) => {
                        const isSelected = selectedMyTeamIds.includes(team.id);
                        const champCount = getMyTeamChampionCount(team, playerPools);
                        return (
                          <button
                            key={team.id}
                            onClick={() => toggleMyTeam(team.id)}
                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-all ${
                              isSelected
                                ? 'bg-blue-500/20 text-blue-400'
                                : 'text-gray-400 hover:bg-lol-surface hover:text-white'
                            }`}
                          >
                            <div
                              className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${
                                isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-600'
                              }`}
                            >
                              {isSelected && (
                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </div>
                            <span className="flex-1">{team.name || 'My Team'}</span>
                            <span className="text-xs text-gray-500">{champCount}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Divider */}
                  {myTeams.length > 0 && enemyTeams.length > 0 && (
                    <div className="border-t border-lol-border" />
                  )}

                  {/* Enemy Teams Section */}
                  {enemyTeams.length > 0 && (
                    <div className="p-2">
                      <div className="text-xs text-gray-500 uppercase tracking-wide px-2 mb-1">Enemy Teams</div>
                      {enemyTeams.map((team) => {
                        const isSelected = selectedEnemyTeamIds.includes(team.id);
                        const champCount = getTeamChampionIds(team).size;
                        return (
                          <button
                            key={team.id}
                            onClick={() => toggleEnemyTeam(team.id)}
                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-all ${
                              isSelected
                                ? 'bg-red-500/20 text-red-400'
                                : 'text-gray-400 hover:bg-lol-surface hover:text-white'
                            }`}
                          >
                            <div
                              className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${
                                isSelected ? 'border-red-500 bg-red-500' : 'border-gray-600'
                              }`}
                            >
                              {isSelected && (
                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </div>
                            <span className="flex-1">vs {team.name}</span>
                            <span className="text-xs text-gray-500">{champCount}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Clear All */}
                  {hasPoolFilter && (
                    <>
                      <div className="border-t border-lol-border" />
                      <div className="p-2">
                        <button
                          onClick={() => {
                            setSelectedMyTeamIds([]);
                            setSelectedEnemyTeamIds([]);
                          }}
                          className="w-full px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-lol-surface rounded-lg text-center transition-all"
                        >
                          Clear All Filters
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


      {/* Champion grid */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {/* Champions in selected pools */}
        <div className="flex flex-wrap gap-2 content-start">
          {inPoolChampions.map((champion) => (
            <DraggableChampion
              key={champion.id}
              championId={champion.id}
            />
          ))}
        </div>

        {/* Champions not in selected pools */}
        {hasPoolFilter && notInPoolChampions.length > 0 && (
          <>
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-lol-border" />
              <span className="text-xs text-gray-500 uppercase tracking-wide">Not in pools</span>
              <div className="flex-1 h-px bg-lol-border" />
            </div>
            <div className="flex flex-wrap gap-2 content-start">
              {notInPoolChampions.map((champion) => (
                <DraggableChampion
                  key={champion.id}
                  championId={champion.id}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
