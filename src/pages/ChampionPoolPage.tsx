import { useState, useEffect } from 'react';
import { useMyTeamStore } from '../stores/useMyTeamStore';
import { useEnemyTeamStore } from '../stores/useEnemyTeamStore';
import { usePlayerPoolStore } from '../stores/usePlayerPoolStore';
import { useCustomPoolStore } from '../stores/useCustomPoolStore';
import { useRankStore } from '../stores/useRankStore';
import { useMasteryStore } from '../stores/useMasteryStore';
import { PlayerTierList } from '../components/champion';
import { Card, ConfirmationModal, Button } from '../components/ui';
import RankBadge from '../components/team/RankBadge';
import { RoleIcon } from '../components/team';
import { ROLES, REGIONS, Region, Player } from '../types';
import { useSettingsStore } from '../stores/useSettingsStore';
import { useOpgg } from '../hooks/useOpgg';

type PoolMode = 'my-team' | 'enemy-teams' | 'custom';

// Inline form shown when a role slot has no player assigned yet
function AddPlayerInline({ player, onSave }: { player: Player; onSave: (name: string, tag: string, region: Region) => void }) {
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const defaultRegion = useSettingsStore((s) => s.defaultRegion);
  const [region, setRegion] = useState<Region>(defaultRegion);

  const handleSave = () => {
    if (name.trim()) onSave(name.trim(), tag.trim(), region);
  };

  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <svg className="w-10 h-10 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
      <p className="text-gray-500 text-sm">
        No player assigned to{' '}
        <span className="text-white capitalize">{ROLES.find(r => r.value === player.role)?.label}</span>.
        Add one to start building their pool.
      </p>
      <div className="flex gap-2 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            placeholder="Summoner name"
            autoFocus
            className="px-3 py-2 bg-lol-dark border border-lol-border rounded text-white placeholder-gray-500 text-sm focus:outline-none focus:border-lol-gold"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Tag</label>
          <input
            type="text"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            placeholder="EUW"
            className="w-24 px-3 py-2 bg-lol-dark border border-lol-border rounded text-white placeholder-gray-500 text-sm focus:outline-none focus:border-lol-gold"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Region</label>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value as Region)}
            className="px-3 py-2 bg-lol-dark border border-lol-border rounded text-white text-sm focus:outline-none focus:border-lol-gold appearance-none cursor-pointer"
          >
            {REGIONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={!name.trim()}
          className="px-4 py-2 rounded bg-lol-gold text-lol-dark font-medium text-sm hover:bg-lol-gold/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Add
        </button>
      </div>
    </div>
  );
}

export default function ChampionPoolPage() {
  const [mode, setMode] = useState<PoolMode>('my-team');

  // My Team state (owned + membership teams)
  const {
    teams: myTeams,
    selectedTeamId,
    memberships,
    membershipTeamData,
    membershipTeamLoading,
    loadMembershipTeamData,
    selectTeam,
    updatePlayer,
  } = useMyTeamStore();
  const isMembershipTeam = memberships.some((m) => m.teamId === selectedTeamId);
  const ownedTeam = myTeams.find((t) => t.id === selectedTeamId) || myTeams[0];
  const myTeam = isMembershipTeam ? (membershipTeamData || ownedTeam) : ownedTeam;
  const playerPoolStore = usePlayerPoolStore();
  const hasMultipleTeams = myTeams.length + memberships.length > 1;

  // Enemy Teams state
  const enemyTeamStore = useEnemyTeamStore();
  const { teams: enemyTeams } = enemyTeamStore;
  const [expandedEnemyTeamId, setExpandedEnemyTeamId] = useState<string | null>(null);
  const [selectedEnemyPlayerIds, setSelectedEnemyPlayerIds] = useState<Record<string, string>>({});
  const [enemySearchQuery, setEnemySearchQuery] = useState('');
  const [showEnemyFavoritesOnly, setShowEnemyFavoritesOnly] = useState(false);

  // Custom Pools state
  const customPoolStore = useCustomPoolStore();
  const [isCreatingCustomPool, setIsCreatingCustomPool] = useState(false);
  const [newPoolName, setNewPoolName] = useState('');
  const [poolToDelete, setPoolToDelete] = useState<string | null>(null);

  // My Team player selection
  const roleOrder = ROLES.map((r) => r.value);
  const myMainPlayers = (myTeam?.players ?? [])
    .filter((p) => !p.isSub)
    .sort((a, b) => roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role));
  const mySubs = (myTeam?.players ?? []).filter((p) => p.isSub);
  const myAllPlayers = [...myMainPlayers, ...mySubs];
  const [selectedMyPlayerId, setSelectedMyPlayerId] = useState<string>(myAllPlayers[0]?.id ?? '');
  const selectedMyPlayer = myAllPlayers.find((p) => p.id === selectedMyPlayerId) ?? myAllPlayers[0];

  // Load membership team data if a membership team is selected on mount
  useEffect(() => {
    if (isMembershipTeam && !membershipTeamData && !membershipTeamLoading) {
      loadMembershipTeamData(selectedTeamId);
    }
  }, [isMembershipTeam, selectedTeamId, membershipTeamData, membershipTeamLoading, loadMembershipTeamData]);

  // Ranks and masteries
  const { fetchRanksFromCache, isConfigured: isRankApiConfigured } = useRankStore();
  const { fetchMasteriesFromCache } = useMasteryStore();
  const { openPlayerProfile } = useOpgg();

  // Fetch ranks from cache on mount
  useEffect(() => {
    if (!isRankApiConfigured()) return;
    const players = myAllPlayers.filter((p) => p.summonerName && p.tagLine);
    if (players.length > 0) {
      fetchRanksFromCache(players);
      fetchMasteriesFromCache(players);
    }
  }, [myTeam?.id, fetchRanksFromCache, fetchMasteriesFromCache, isRankApiConfigured]);

  // Find the pool for the selected my team player
  const myPlayerPool = selectedMyPlayer?.summonerName
    ? playerPoolStore.findPool(selectedMyPlayer.summonerName, selectedMyPlayer.role)
    : null;

  const resolveMyPlayerPool = () => {
    if (!selectedMyPlayer?.summonerName) return null;
    return playerPoolStore.getOrCreatePool(selectedMyPlayer.summonerName, selectedMyPlayer.tagLine, selectedMyPlayer.role);
  };

  const withMyPlayerPool = <T,>(fn: (poolId: string) => T): T | undefined => {
    const p = resolveMyPlayerPool();
    if (!p) return undefined;
    return fn(p.id);
  };

  // Enemy teams filtering
  const filteredEnemyTeams = enemyTeams
    .filter((team) => {
      const searchLower = enemySearchQuery.toLowerCase();
      const matchesSearch =
        !enemySearchQuery ||
        team.name.toLowerCase().includes(searchLower) ||
        team.players.some((p) => p.summonerName?.toLowerCase().includes(searchLower));
      if (!matchesSearch) return false;
      if (showEnemyFavoritesOnly && !team.isFavorite) return false;
      return true;
    })
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  const handleCreateCustomPool = () => {
    if (newPoolName.trim()) {
      customPoolStore.createPool(newPoolName.trim());
      setNewPoolName('');
      setIsCreatingCustomPool(false);
    }
  };

  const selectedCustomPool = customPoolStore.pools.find((p) => p.id === customPoolStore.selectedPoolId);

  const getMainRoster = (players: Player[]) => players.filter((p) => !p.isSub);
  const getSubs = (players: Player[]) => players.filter((p) => p.isSub);

  return (
    <div className="space-y-6">
      {/* Header with Mode Tabs */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Champion Pools</h1>
          <p className="text-gray-400 mt-1">Manage champion pools for drafting</p>
        </div>
      </div>

      {/* Mode Tabs */}
      <div className="flex gap-1 bg-lol-dark/80 p-1.5 rounded-xl border border-lol-border w-fit">
        <button
          onClick={() => setMode('my-team')}
          className={`px-5 py-2.5 rounded-lg font-semibold transition-all duration-200 flex items-center gap-2 ${
            mode === 'my-team'
              ? 'bg-lol-gold/15 text-lol-gold border border-lol-gold/40 shadow-sm'
              : 'text-gray-400 hover:text-white hover:bg-lol-surface/50 border border-transparent'
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {hasMultipleTeams ? 'My Teams' : 'My Team'}
        </button>
        <button
          onClick={() => setMode('enemy-teams')}
          className={`px-5 py-2.5 rounded-lg font-semibold transition-all duration-200 flex items-center gap-2 ${
            mode === 'enemy-teams'
              ? 'bg-red-500/15 text-red-400 border border-red-500/40 shadow-sm'
              : 'text-gray-400 hover:text-white hover:bg-lol-surface/50 border border-transparent'
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
          </svg>
          Enemy Teams
          {enemyTeams.length > 0 && (
            <span className="px-1.5 py-0.5 rounded text-xs bg-red-500/20 text-red-400/80">{enemyTeams.length}</span>
          )}
        </button>
        <button
          onClick={() => setMode('custom')}
          className={`px-5 py-2.5 rounded-lg font-semibold transition-all duration-200 flex items-center gap-2 ${
            mode === 'custom'
              ? 'bg-blue-500/15 text-blue-400 border border-blue-500/40 shadow-sm'
              : 'text-gray-400 hover:text-white hover:bg-lol-surface/50 border border-transparent'
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          Custom Pools
          {customPoolStore.pools.length > 0 && (
            <span className="px-1.5 py-0.5 rounded text-xs bg-blue-500/20 text-blue-400/80">{customPoolStore.pools.length}</span>
          )}
        </button>
      </div>

      {/* My Team Mode */}
      {mode === 'my-team' && (
        <div className="space-y-4">
          {/* Team Selector (only if multiple teams) */}
          {hasMultipleTeams && (
            <div className="flex items-center gap-2 flex-wrap">
              {myTeams.map((t) => (
                <button
                  key={t.id}
                  onClick={() => selectTeam(t.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                    t.id === selectedTeamId
                      ? 'bg-lol-gold/20 border border-lol-gold text-lol-gold'
                      : 'bg-lol-card border border-lol-border text-gray-400 hover:border-gray-500 hover:text-gray-300'
                  }`}
                >
                  <span className="font-medium truncate max-w-32">{t.name || 'Unnamed'}</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-yellow-500/20 text-yellow-400">
                    Owner
                  </span>
                </button>
              ))}
              {memberships.map((m) => (
                <button
                  key={m.teamId}
                  onClick={() => selectTeam(m.teamId)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                    m.teamId === selectedTeamId
                      ? 'bg-lol-gold/20 border border-lol-gold text-lol-gold'
                      : 'bg-lol-card border border-lol-border text-gray-400 hover:border-gray-500 hover:text-gray-300'
                  }`}
                >
                  <span className="font-medium truncate max-w-32">{m.teamName}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    m.role === 'admin'
                      ? 'bg-purple-500/20 text-purple-400'
                      : m.role === 'player'
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-blue-500/20 text-blue-400'
                  }`}>
                    {m.role.charAt(0).toUpperCase() + m.role.slice(1)}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Loading state for membership teams */}
          {isMembershipTeam && membershipTeamLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-lol-gold" />
            </div>
          ) : !myTeam ? (
            <Card className="text-center py-12">
              <p className="text-gray-400">No team created yet. Go to My Team page to create one.</p>
            </Card>
          ) : myAllPlayers.length === 0 ? (
            <Card className="text-center py-12">
              <p className="text-gray-400">No players in your team yet.</p>
            </Card>
          ) : (
            <Card variant="bordered" padding="lg">
              {/* Team Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-white">{myTeam.name || 'My Team'}</h2>
              </div>

              {/* Player Tabs */}
              <div className="flex flex-wrap gap-2 mb-6">
                <div className="flex gap-1 bg-lol-dark p-1 rounded-xl border border-lol-border">
                  {myMainPlayers.map((player) => {
                    const roleLabel = ROLES.find(r => r.value === player.role)?.label;
                    const isSelected = player.id === selectedMyPlayerId;

                    return (
                      <button
                        key={player.id}
                        onClick={() => setSelectedMyPlayerId(player.id)}
                        className={`px-4 py-2.5 rounded-lg font-medium transition-all duration-200 min-w-32 text-center ${
                          isSelected
                            ? 'bg-lol-gold/20 text-lol-gold border border-lol-gold/50 shadow-sm'
                            : 'text-gray-400 hover:text-white hover:bg-lol-surface/50 border border-transparent'
                        }`}
                      >
                        <div className="text-sm flex items-center justify-center gap-1">
                          <RoleIcon role={player.role} size="xs" />
                          {roleLabel}
                        </div>
                        <div className={`text-xs mt-0.5 truncate ${isSelected ? 'text-lol-gold' : 'text-gray-500'}`}>
                          {player.summonerName || 'Empty'}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Subs Tabs */}
                {mySubs.length > 0 && (
                  <div className="flex gap-1 bg-lol-dark p-1 rounded-xl border border-lol-border/50">
                    {mySubs.map((player) => {
                      const isSelected = player.id === selectedMyPlayerId;

                      return (
                        <button
                          key={player.id}
                          onClick={() => setSelectedMyPlayerId(player.id)}
                          className={`px-4 py-2.5 rounded-lg font-medium transition-all duration-200 min-w-32 text-center ${
                            isSelected
                              ? 'bg-lol-gold/20 text-lol-gold border border-lol-gold/50 shadow-sm'
                              : 'text-gray-400 hover:text-white hover:bg-lol-surface/50 border border-transparent'
                          }`}
                        >
                          <div className="text-sm text-orange-400 flex items-center justify-center gap-1">
                            <RoleIcon role={player.role} size="xs" />
                            Sub
                          </div>
                          <div className={`text-xs mt-0.5 truncate ${isSelected ? 'text-lol-gold' : 'text-gray-500'}`}>
                            {player.summonerName || 'Empty'}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Selected Player Content */}
              {selectedMyPlayer && (
                <>
                  {!selectedMyPlayer.summonerName ? (
                    <AddPlayerInline
                      player={selectedMyPlayer}
                      onSave={(name, tag, region) => updatePlayer(selectedMyPlayer.id, { summonerName: name, tagLine: tag, region })}
                    />
                  ) : (
                    <>
                      <PlayerTierList
                        player={{
                          role: selectedMyPlayer.role,
                          championGroups: myPlayerPool?.championGroups ?? [],
                          allowDuplicateChampions: myPlayerPool?.allowDuplicateChampions,
                          summonerName: selectedMyPlayer.summonerName,
                          tagLine: selectedMyPlayer.tagLine,
                          region: selectedMyPlayer.region,
                        }}
                        onAddChampion={(groupId, championId) =>
                          withMyPlayerPool((id) => playerPoolStore.addChampionToGroup(id, groupId, championId))
                        }
                        onRemoveChampion={(groupId, championId) =>
                          withMyPlayerPool((id) => playerPoolStore.removeChampionFromGroup(id, groupId, championId))
                        }
                        onMoveChampion={(fromGroupId, toGroupId, championId, newIndex) =>
                          withMyPlayerPool((id) => playerPoolStore.moveChampion(id, fromGroupId, toGroupId, championId, newIndex))
                        }
                        onReorderChampion={(groupId, championId, newIndex) =>
                          withMyPlayerPool((id) => playerPoolStore.reorderChampionInGroup(id, groupId, championId, newIndex))
                        }
                        onAddGroup={(groupName) =>
                          withMyPlayerPool((id) => playerPoolStore.addGroup(id, groupName))
                        }
                        onRemoveGroup={(groupId) =>
                          withMyPlayerPool((id) => playerPoolStore.removeGroup(id, groupId))
                        }
                        onRenameGroup={(groupId, newName) =>
                          withMyPlayerPool((id) => playerPoolStore.renameGroup(id, groupId, newName))
                        }
                        onReorderGroups={(groupIds) =>
                          withMyPlayerPool((id) => playerPoolStore.reorderGroups(id, groupIds))
                        }
                        onSetAllowDuplicates={(allowDuplicates) =>
                          withMyPlayerPool((id) => playerPoolStore.setAllowDuplicateChampions(id, allowDuplicates))
                        }
                      />
                    </>
                  )}
                </>
              )}
            </Card>
          )}
        </div>
      )}

      {/* Enemy Teams Mode */}
      {mode === 'enemy-teams' && (
        <div className="space-y-4">
          {/* Search and Filter Bar */}
          {enemyTeams.length > 0 && (
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
                  value={enemySearchQuery}
                  onChange={(e) => setEnemySearchQuery(e.target.value)}
                  placeholder="Search teams or players..."
                  className="w-full pl-10 pr-4 py-2.5 bg-lol-dark border border-lol-border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-lol-gold/50 focus:ring-2 focus:ring-lol-gold/20 transition-all duration-200"
                />
              </div>
              <button
                onClick={() => setShowEnemyFavoritesOnly(!showEnemyFavoritesOnly)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all duration-200 ${
                  showEnemyFavoritesOnly
                    ? 'bg-lol-gold/20 border-lol-gold text-lol-gold'
                    : 'bg-lol-dark border-lol-border text-gray-400 hover:text-white hover:border-gray-500'
                }`}
              >
                <svg
                  className="w-4 h-4"
                  fill={showEnemyFavoritesOnly ? 'currentColor' : 'none'}
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
            </div>
          )}

          {enemyTeams.length === 0 ? (
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
              <p className="text-gray-400 mb-2">No enemy teams added yet</p>
              <p className="text-sm text-gray-500">Go to the Enemy Teams page to add teams</p>
            </Card>
          ) : filteredEnemyTeams.length === 0 ? (
            <Card className="text-center py-8">
              <p className="text-gray-400">
                No teams match your search
                {showEnemyFavoritesOnly ? ' or favorites filter' : ''}.
              </p>
              <button
                onClick={() => {
                  setEnemySearchQuery('');
                  setShowEnemyFavoritesOnly(false);
                }}
                className="mt-3 text-lol-gold hover:text-lol-gold-light transition-colors"
              >
                Clear filters
              </button>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredEnemyTeams.map((team) => {
                const mainRoster = getMainRoster(team.players);
                const subs = getSubs(team.players);
                const filledPlayers = team.players.filter(p => p.summonerName).length;
                const isExpanded = expandedEnemyTeamId === team.id;

                return (
                  <Card key={team.id} variant="bordered" padding="lg">
                    <div className="flex items-center justify-between">
                      <div
                        className="flex-1 cursor-pointer"
                        onClick={() => setExpandedEnemyTeamId(isExpanded ? null : team.id)}
                      >
                        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                          {team.name}
                          {team.isFavorite && (
                            <svg className="w-4 h-4 text-lol-gold" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                            </svg>
                          )}
                        </h2>
                        <p className="text-sm text-gray-400 mt-1">
                          {filledPlayers} players ({mainRoster.filter(p => p.summonerName).length} main
                          {subs.length > 0 && `, ${subs.filter(p => p.summonerName).length} subs`})
                        </p>
                      </div>
                      <button
                        onClick={() => setExpandedEnemyTeamId(isExpanded ? null : team.id)}
                        className={`p-2 rounded-lg transition-all duration-200 ${
                          isExpanded ? 'bg-lol-surface text-white' : 'text-gray-500 hover:text-white'
                        }`}
                      >
                        <svg
                          className={`w-5 h-5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="mt-6 pt-6 border-t border-lol-border">
                        {/* Player Tabs */}
                        <div className="mb-4">
                          <h3 className="text-sm font-medium text-gray-300 mb-3">
                            Player Champion Pools
                          </h3>
                          <p className="text-xs text-gray-400 font-light mb-4">
                            Select a player to view/edit their champion pool
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2 mb-6">
                          <div className="flex gap-1 bg-lol-dark p-1 rounded-xl border border-lol-border">
                            {ROLES.map((role) => {
                              const player = mainRoster.find(p => p.role === role.value);
                              if (!player) return null;
                              const selectedId = selectedEnemyPlayerIds[team.id] || mainRoster.find(p => p.role === 'top')?.id || mainRoster[0]?.id;
                              const isSelected = player.id === selectedId;

                              return (
                                <button
                                  key={player.id}
                                  onClick={() => setSelectedEnemyPlayerIds(prev => ({ ...prev, [team.id]: player.id }))}
                                  className={`px-4 py-2.5 rounded-lg font-medium transition-all duration-200 min-w-32 text-center ${
                                    isSelected
                                      ? 'bg-red-500/20 text-red-400 border border-red-500/50 shadow-sm'
                                      : 'text-gray-400 hover:text-white hover:bg-lol-surface/50 border border-transparent'
                                  }`}
                                >
                                  <div className="text-sm flex items-center justify-center gap-1">
                                    <RoleIcon role={role.value} size="xs" />
                                    {role.label}
                                  </div>
                                  <div className={`text-xs mt-0.5 truncate ${isSelected ? 'text-red-400' : 'text-gray-500'}`}>
                                    {player.summonerName || 'Empty'}
                                  </div>
                                </button>
                              );
                            })}
                          </div>

                          {/* Subs Tabs */}
                          {subs.length > 0 && (
                            <div className="flex gap-1 bg-lol-dark p-1 rounded-xl border border-lol-border/50">
                              {subs.map((player) => {
                                const selectedId = selectedEnemyPlayerIds[team.id] || mainRoster.find(p => p.role === 'top')?.id || mainRoster[0]?.id;
                                const isSelected = player.id === selectedId;

                                return (
                                  <button
                                    key={player.id}
                                    onClick={() => setSelectedEnemyPlayerIds(prev => ({ ...prev, [team.id]: player.id }))}
                                    className={`px-4 py-2.5 rounded-lg font-medium transition-all duration-200 min-w-32 text-center ${
                                      isSelected
                                        ? 'bg-red-500/20 text-red-400 border border-red-500/50 shadow-sm'
                                        : 'text-gray-400 hover:text-white hover:bg-lol-surface/50 border border-transparent'
                                    }`}
                                  >
                                    <div className="text-sm text-orange-400 flex items-center justify-center gap-1">
                                      <RoleIcon role={player.role} size="xs" />
                                      Sub
                                    </div>
                                    <div className={`text-xs mt-0.5 truncate ${isSelected ? 'text-red-400' : 'text-gray-500'}`}>
                                      {player.summonerName || 'Empty'}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Selected Player's Champion Pool */}
                        {(() => {
                          const selectedId = selectedEnemyPlayerIds[team.id] || mainRoster.find(p => p.role === 'top')?.id || mainRoster[0]?.id;
                          const selectedPlayer = team.players.find(p => p.id === selectedId);
                          if (!selectedPlayer) return null;

                          return (
                            <PlayerTierList
                              player={selectedPlayer}
                              onAddChampion={(groupId, championId) =>
                                enemyTeamStore.addChampionToGroup(team.id, selectedPlayer.id, groupId, championId)
                              }
                              onRemoveChampion={(groupId, championId) =>
                                enemyTeamStore.removeChampionFromGroup(team.id, selectedPlayer.id, groupId, championId)
                              }
                              onMoveChampion={(fromGroupId, toGroupId, championId, newIndex) =>
                                enemyTeamStore.moveChampion(team.id, selectedPlayer.id, fromGroupId, toGroupId, championId, newIndex)
                              }
                              onReorderChampion={(groupId, championId, newIndex) =>
                                enemyTeamStore.reorderChampionInGroup(team.id, selectedPlayer.id, groupId, championId, newIndex)
                              }
                              onAddGroup={(groupName) =>
                                enemyTeamStore.addGroup(team.id, selectedPlayer.id, groupName)
                              }
                              onRemoveGroup={(groupId) =>
                                enemyTeamStore.removeGroup(team.id, selectedPlayer.id, groupId)
                              }
                              onRenameGroup={(groupId, newName) =>
                                enemyTeamStore.renameGroup(team.id, selectedPlayer.id, groupId, newName)
                              }
                              onReorderGroups={(groupIds) =>
                                enemyTeamStore.reorderGroups(team.id, selectedPlayer.id, groupIds)
                              }
                              onSetAllowDuplicates={(allowDuplicates) =>
                                enemyTeamStore.setAllowDuplicateChampions(team.id, selectedPlayer.id, allowDuplicates)
                              }
                              onAddNote={() =>
                                enemyTeamStore.addPlayerNote(team.id, selectedPlayer.id)
                              }
                              onUpdateNote={(noteId, content) =>
                                enemyTeamStore.updatePlayerNote(team.id, selectedPlayer.id, noteId, content)
                              }
                              onDeleteNote={(noteId) =>
                                enemyTeamStore.deletePlayerNote(team.id, selectedPlayer.id, noteId)
                              }
                            />
                          );
                        })()}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Custom Pools Mode */}
      {mode === 'custom' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-gray-400 text-sm">
              Create custom champion pools that aren't tied to specific players
            </p>
            {!isCreatingCustomPool && (
              <Button
                onClick={() => setIsCreatingCustomPool(true)}
                className="bg-lol-surface hover:bg-lol-card-hover border border-lol-border"
              >
                + New Custom Pool
              </Button>
            )}
          </div>

          {isCreatingCustomPool && (
            <Card variant="bordered" padding="md">
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-300 mb-2">Pool Name</label>
                  <input
                    type="text"
                    value={newPoolName}
                    onChange={(e) => setNewPoolName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateCustomPool();
                      if (e.key === 'Escape') {
                        setIsCreatingCustomPool(false);
                        setNewPoolName('');
                      }
                    }}
                    placeholder="e.g., Meta Picks, Counter Picks..."
                    autoFocus
                    className="w-full px-3 py-2 bg-lol-dark border border-lol-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-lol-gold/50"
                  />
                </div>
                <Button
                  onClick={handleCreateCustomPool}
                  disabled={!newPoolName.trim()}
                  className="bg-lol-surface hover:bg-lol-card-hover border border-lol-border"
                >
                  Create
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setIsCreatingCustomPool(false);
                    setNewPoolName('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            </Card>
          )}

          {customPoolStore.pools.length === 0 && !isCreatingCustomPool ? (
            <Card className="text-center py-12">
              <div className="text-gray-500 mb-2">
                <svg className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <p className="text-gray-400 mb-4">No custom pools yet</p>
              <Button
                onClick={() => setIsCreatingCustomPool(true)}
                className="bg-lol-surface hover:bg-lol-card-hover border border-lol-border"
              >
                Create Your First Pool
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              {/* Pool List Sidebar */}
              <div className="lg:col-span-1 space-y-2">
                {customPoolStore.pools.map((pool) => {
                  const isSelected = pool.id === customPoolStore.selectedPoolId;
                  const champCount = pool.championGroups.reduce((n, g) => n + g.championIds.length, 0);

                  return (
                    <button
                      key={pool.id}
                      onClick={() => customPoolStore.selectPool(pool.id)}
                      className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-200 ${
                        isSelected
                          ? 'bg-lol-gold/15 border border-lol-gold/60 text-white'
                          : 'bg-lol-card border border-lol-border text-gray-400 hover:border-gray-500 hover:text-white'
                      }`}
                    >
                      <div className="font-semibold truncate">{pool.name}</div>
                      <div className="text-xs mt-0.5 opacity-70">
                        {champCount} champion{champCount !== 1 ? 's' : ''}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Selected Pool Editor */}
              <div className="lg:col-span-3">
                {selectedCustomPool ? (
                  <Card variant="bordered" padding="lg">
                    <div className="flex items-center justify-between mb-4 pb-4 border-b border-lol-border">
                      <div>
                        <h2 className="text-lg font-bold text-white leading-tight">
                          {selectedCustomPool.name}
                        </h2>
                        <p className="text-xs text-gray-500">
                          {selectedCustomPool.championGroups.reduce((n, g) => n + g.championIds.length, 0)} champions
                        </p>
                      </div>
                      <button
                        onClick={() => setPoolToDelete(selectedCustomPool.id)}
                        className="px-3 py-1.5 rounded text-red-400 hover:text-red-300 hover:bg-red-900/20 text-sm transition-colors"
                      >
                        Delete Pool
                      </button>
                    </div>

                    <PlayerTierList
                      player={{
                        championGroups: selectedCustomPool.championGroups,
                        allowDuplicateChampions: selectedCustomPool.allowDuplicateChampions,
                      }}
                      onAddChampion={(groupId, championId) =>
                        customPoolStore.addChampionToGroup(selectedCustomPool.id, groupId, championId)
                      }
                      onRemoveChampion={(groupId, championId) =>
                        customPoolStore.removeChampionFromGroup(selectedCustomPool.id, groupId, championId)
                      }
                      onMoveChampion={(fromGroupId, toGroupId, championId, newIndex) =>
                        customPoolStore.moveChampion(selectedCustomPool.id, fromGroupId, toGroupId, championId, newIndex)
                      }
                      onReorderChampion={(groupId, championId, newIndex) =>
                        customPoolStore.reorderChampionInGroup(selectedCustomPool.id, groupId, championId, newIndex)
                      }
                      onAddGroup={(groupName) =>
                        customPoolStore.addGroup(selectedCustomPool.id, groupName)
                      }
                      onRemoveGroup={(groupId) =>
                        customPoolStore.removeGroup(selectedCustomPool.id, groupId)
                      }
                      onRenameGroup={(groupId, newName) =>
                        customPoolStore.renameGroup(selectedCustomPool.id, groupId, newName)
                      }
                      onReorderGroups={(groupIds) =>
                        customPoolStore.reorderGroups(selectedCustomPool.id, groupIds)
                      }
                      onSetAllowDuplicates={(allowDuplicates) =>
                        customPoolStore.setAllowDuplicateChampions(selectedCustomPool.id, allowDuplicates)
                      }
                    />
                  </Card>
                ) : (
                  <Card className="text-center py-12">
                    <p className="text-gray-400">Select a pool from the list to edit it</p>
                  </Card>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete Pool Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!poolToDelete}
        onClose={() => setPoolToDelete(null)}
        onConfirm={() => {
          if (poolToDelete) {
            customPoolStore.deletePool(poolToDelete);
            setPoolToDelete(null);
          }
        }}
        title="Delete Pool"
        message={`Are you sure you want to delete "${selectedCustomPool?.name}"?`}
        confirmText="Delete"
      />
    </div>
  );
}
