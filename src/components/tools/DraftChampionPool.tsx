import { useState, useMemo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { useChampionData } from '../../hooks/useChampionData';
import { getChampionRoles } from '../../data/championRoles';
import { Role, Team, ChampionGroup } from '../../types';
import DraggableChampion from './DraggableChampion';
import { useMyTeamStore } from '../../stores/useMyTeamStore';
import { useEnemyTeamStore } from '../../stores/useEnemyTeamStore';
import { usePlayerPoolStore } from '../../stores/usePlayerPoolStore';
import { useDraftStore } from '../../stores/useDraftStore';
import { useCustomPoolStore } from '../../stores/useCustomPoolStore';
import { useDraftAnalytics } from '../draft/hooks/useDraftAnalytics';

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
  const [poolSearch, setPoolSearch] = useState('');

  // Link Draft state
  type DataFilter = 'bans' | 'priorities' | 'contests' | null;
  const allSessions = useDraftStore((s) => s.sessions);
  const customPools = useCustomPoolStore((s) => s.pools);
  const [linkedDraftId, setLinkedDraftId] = useState<string | null>(null);
  const [showDraftDropdown, setShowDraftDropdown] = useState(false);
  const [draftSearch, setDraftSearch] = useState('');
  const [activeDataFilter, setActiveDataFilter] = useState<DataFilter>(null);

  const linkedDraftSession = useMemo(() => {
    if (!linkedDraftId) return null;
    return allSessions.find((s) => s.id === linkedDraftId) ?? null;
  }, [linkedDraftId, allSessions]);

  const availableDraftSessions = allSessions;

  const filteredDraftSessions = useMemo(() => {
    if (!draftSearch) return availableDraftSessions;
    const q = draftSearch.toLowerCase();
    return availableDraftSessions.filter((s) => s.name.toLowerCase().includes(q));
  }, [availableDraftSessions, draftSearch]);

  // Linked draft data
  const linkedBanGroups = useMemo(() => linkedDraftSession?.banGroups ?? [], [linkedDraftSession]);
  const linkedPriorityGroups = useMemo(() => linkedDraftSession?.priorityGroups ?? [], [linkedDraftSession]);
  const linkedBanCount = useMemo(() => linkedBanGroups.reduce((sum, g) => sum + g.championIds.length, 0), [linkedBanGroups]);
  const linkedPriorityCount = useMemo(() => linkedPriorityGroups.reduce((sum, g) => sum + g.championIds.length, 0), [linkedPriorityGroups]);

  // Resolve linked draft's teams for contested calculation
  const linkedEnemyTeam = useMemo(() => {
    if (!linkedDraftSession?.enemyTeamId) return null;
    return enemyTeams.find((t) => t.id === linkedDraftSession.enemyTeamId) ?? null;
  }, [linkedDraftSession, enemyTeams]);

  const linkedMyTeam = useMemo(() => {
    if (!linkedDraftSession?.myTeamId) return null;
    return myTeams.find((t) => t.id === linkedDraftSession.myTeamId) ?? null;
  }, [linkedDraftSession, myTeams]);

  const linkedAnalytics = useDraftAnalytics({
    myTeam: linkedMyTeam,
    enemyTeam: linkedEnemyTeam,
    customPools,
    selectedCustomPoolIds: [],
    tierFilter: ['S', 'A', 'B', 'C'],
    playerPools,
  });

  const contestedChampionIds = useMemo(
    () => new Set(linkedAnalytics.contested.map((c) => c.championId)),
    [linkedAnalytics.contested],
  );
  const contestedCount = contestedChampionIds.size;

  // Active groups for the data filter view
  const activeGroups: ChampionGroup[] | null = useMemo(() => {
    if (activeDataFilter === 'bans') return linkedBanGroups;
    if (activeDataFilter === 'priorities') return linkedPriorityGroups;
    if (activeDataFilter === 'contests') {
      if (contestedChampionIds.size === 0) return [];
      return [{ id: 'contested', name: 'Contested Picks', championIds: [...contestedChampionIds] }];
    }
    return null;
  }, [activeDataFilter, linkedBanGroups, linkedPriorityGroups, contestedChampionIds]);

  const toggleDataFilter = (filter: DataFilter) => {
    setActiveDataFilter((prev) => (prev === filter ? null : filter));
  };

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
    // When data filter is active, the grid shows grouped view instead
    if (activeGroups !== null) return { inPoolChampions: [], notInPoolChampions: [] };

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
  }, [champions, search, searchChampions, selectedRoles, usedChampionIds, hasPoolFilter, poolFilterChampionIds, activeGroups]);

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
      {/* Link Draft + Search + Pools */}
      <div className="flex items-center gap-2 mb-3 shrink-0">
        {/* Link Draft Dropdown */}
        <div className="relative shrink-0">
          <button
            onClick={() => { setShowDraftDropdown(!showDraftDropdown); setDraftSearch(''); }}
            className={`
              flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all
              ${linkedDraftSession
                ? 'bg-lol-gold/15 text-lol-gold border border-lol-gold/40'
                : 'bg-lol-dark text-gray-400 border border-lol-border hover:text-gray-300 hover:border-lol-border-light'
              }
            `}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="max-w-28 truncate">{linkedDraftSession ? linkedDraftSession.name : 'Link Draft'}</span>
            <svg className={`w-3.5 h-3.5 transition-transform ${showDraftDropdown ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showDraftDropdown && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowDraftDropdown(false)} />
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
                      onClick={() => { setLinkedDraftId(null); setShowDraftDropdown(false); setActiveDataFilter(null); }}
                      className="w-full px-3 py-2 text-xs text-gray-400 hover:text-white hover:bg-lol-surface text-left flex items-center gap-2"
                    >
                      <svg className="w-3.5 h-3.5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Unlink draft
                    </button>
                  )}
                  {filteredDraftSessions.length === 0 ? (
                    <div className="px-3 py-3 text-xs text-gray-500 text-center">
                      {availableDraftSessions.length === 0 ? 'No draft sessions' : 'No matches'}
                    </div>
                  ) : (
                    filteredDraftSessions.map((ds) => (
                      <button
                        key={ds.id}
                        onClick={() => { setLinkedDraftId(ds.id); setShowDraftDropdown(false); }}
                        className={`w-full px-3 py-2 text-xs text-left hover:bg-lol-surface transition-colors flex items-center gap-2 ${
                          ds.id === linkedDraftId ? 'text-lol-gold bg-lol-gold/10' : 'text-gray-300'
                        }`}
                      >
                        <span className="flex-1 truncate">{ds.name}</span>
                        {ds.id === linkedDraftId && (
                          <svg className="w-3.5 h-3.5 text-lol-gold shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
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

        {/* Search */}
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search champions..."
          className="flex-1 min-w-0 px-3 py-2 bg-lol-dark border border-lol-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-lol-gold"
        />

        {/* Team Pool Filter Dropdown */}
        {(myTeams.length > 0 || enemyTeams.length > 0) && (
          <div className="relative shrink-0">
            <button
              onClick={() => { setShowPoolDropdown(!showPoolDropdown); setPoolSearch(''); }}
              className={`
                flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all
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
            </button>

            {showPoolDropdown && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowPoolDropdown(false)} />
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
                            className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-left transition-all ${
                              isSelected
                                ? 'bg-blue-500/20 text-blue-400'
                                : 'text-gray-400 hover:bg-lol-surface hover:text-white'
                            }`}
                          >
                            <div className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center shrink-0 ${
                              isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-600'
                            }`}>
                              {isSelected && (
                                <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </div>
                            <span className="flex-1 truncate">{team.name || 'My Team'}</span>
                            <span className="text-[10px] text-gray-500">{champCount}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {myTeams.length > 0 && enemyTeams.length > 0 && (
                    <div className="border-t border-lol-border" />
                  )}
                  {/* Enemy Teams Section */}
                  {enemyTeams.length > 0 && (
                    <div className="p-2">
                      <div className="text-xs text-gray-500 uppercase tracking-wide px-2 mb-1">Enemy Teams</div>
                      <div className="px-1 mb-1">
                        <input
                          type="text"
                          value={poolSearch}
                          onChange={(e) => setPoolSearch(e.target.value)}
                          placeholder="Search teams..."
                          className="w-full px-2.5 py-1.5 bg-lol-dark border border-lol-border rounded-lg text-white text-xs placeholder-gray-500 focus:outline-none focus:border-lol-gold/50"
                        />
                      </div>
                      {enemyTeams.filter((t) => !poolSearch || t.name.toLowerCase().includes(poolSearch.toLowerCase())).map((team) => {
                        const isSelected = selectedEnemyTeamIds.includes(team.id);
                        const champCount = getTeamChampionIds(team).size;
                        return (
                          <button
                            key={team.id}
                            onClick={() => toggleEnemyTeam(team.id)}
                            className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-left transition-all ${
                              isSelected
                                ? 'bg-red-500/20 text-red-400'
                                : 'text-gray-400 hover:bg-lol-surface hover:text-white'
                            }`}
                          >
                            <div className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center shrink-0 ${
                              isSelected ? 'border-red-500 bg-red-500' : 'border-gray-600'
                            }`}>
                              {isSelected && (
                                <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </div>
                            <span className="flex-1 truncate">vs {team.name}</span>
                            <span className="text-[10px] text-gray-500">{champCount}</span>
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
                          onClick={() => { setSelectedMyTeamIds([]); setSelectedEnemyTeamIds([]); }}
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

      {/* Role filters + Data Filter Buttons */}
      <div className="flex items-center justify-between gap-2 mb-3 shrink-0">
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

        {linkedDraftSession && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => toggleDataFilter('bans')}
              className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeDataFilter === 'bans'
                  ? 'bg-red-500/20 text-red-400 border border-red-500/50'
                  : 'bg-lol-dark text-gray-400 border border-lol-border hover:text-red-400 hover:border-red-500/30'
              }`}
            >
              Bans
              {linkedBanCount > 0 && (
                <span className={`px-1 rounded text-[10px] ${activeDataFilter === 'bans' ? 'bg-red-500/30' : 'bg-gray-600/50'}`}>
                  {linkedBanCount}
                </span>
              )}
            </button>
            <button
              onClick={() => toggleDataFilter('priorities')}
              className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeDataFilter === 'priorities'
                  ? 'bg-lol-gold/20 text-lol-gold border border-lol-gold/50'
                  : 'bg-lol-dark text-gray-400 border border-lol-border hover:text-lol-gold hover:border-lol-gold/30'
              }`}
            >
              Priorities
              {linkedPriorityCount > 0 && (
                <span className={`px-1 rounded text-[10px] ${activeDataFilter === 'priorities' ? 'bg-lol-gold/30' : 'bg-gray-600/50'}`}>
                  {linkedPriorityCount}
                </span>
              )}
            </button>
            {contestedCount > 0 && (
              <button
                onClick={() => toggleDataFilter('contests')}
                className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-all ${
                  activeDataFilter === 'contests'
                    ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50'
                    : 'bg-lol-dark text-gray-400 border border-lol-border hover:text-yellow-400 hover:border-yellow-500/30'
                }`}
              >
                Contested
                <span className={`px-1 rounded text-[10px] ${activeDataFilter === 'contests' ? 'bg-yellow-500/30' : 'bg-gray-600/50'}`}>
                  {contestedCount}
                </span>
              </button>
            )}
          </div>
        )}
      </div>


      {/* Champion grid / Grouped view */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {activeGroups !== null ? (
          /* Grouped view (data filter active) */
          activeGroups.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              {activeDataFilter === 'bans' ? 'No bans planned' : activeDataFilter === 'priorities' ? 'No priorities set' : 'No contested picks'}
            </div>
          ) : (
            <div className="space-y-4">
              {activeGroups.map((group) => (
                <div key={group.id}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs font-medium uppercase tracking-wide ${
                      activeDataFilter === 'bans' ? 'text-red-400' : activeDataFilter === 'priorities' ? 'text-lol-gold' : 'text-yellow-400'
                    }`}>
                      {group.name}
                    </span>
                    <span className="text-[10px] text-gray-500">({group.championIds.length})</span>
                    <div className="flex-1 h-px bg-lol-border/50" />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {group.championIds.map((championId) => (
                      <DraggableChampion
                        key={championId}
                        championId={championId}
                        disabled={usedChampionIds.includes(championId)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          /* Normal grid */
          <>
            <div className="flex flex-wrap gap-2 content-start">
              {inPoolChampions.map((champion) => (
                <DraggableChampion
                  key={champion.id}
                  championId={champion.id}
                />
              ))}
            </div>

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
          </>
        )}
      </div>
    </div>
  );
}
