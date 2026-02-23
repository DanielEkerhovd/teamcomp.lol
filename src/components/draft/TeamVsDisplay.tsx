import { useState, useMemo, useEffect } from 'react';
import { Team, Player, Role, ROLES, DEFAULT_REGION } from '../../types';
import { useEnemyTeamStore } from '../../stores/useEnemyTeamStore';
import { useRankStore } from '../../stores/useRankStore';
import { usePlayerPoolStore } from '../../stores/usePlayerPoolStore';
import { useOpgg } from '../../hooks/useOpgg';
import { ChampionIcon } from '../champion';

interface TeamVsDisplayProps {
  myTeam: Team;
  enemyTeam: Team | null;
  selectedEnemyTeamId: string | null;
  onSelectEnemyTeam: (teamId: string | null) => void;
}

const RANK_COLORS: Record<string, string> = {
  IRON: 'text-gray-500',
  BRONZE: 'text-amber-700',
  SILVER: 'text-gray-400',
  GOLD: 'text-yellow-500',
  PLATINUM: 'text-teal-400',
  EMERALD: 'text-emerald-400',
  DIAMOND: 'text-blue-400',
  MASTER: 'text-purple-400',
  GRANDMASTER: 'text-red-400',
  CHALLENGER: 'text-yellow-300',
};

function formatRank(tier: string, division: string, lp?: number): string {
  // Master+ don't have divisions, show LP instead
  if (['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(tier)) {
    const tierName = tier.charAt(0) + tier.slice(1).toLowerCase();
    return lp !== undefined ? `${tierName} ${lp} LP` : tierName;
  }
  return `${tier.charAt(0) + tier.slice(1).toLowerCase()} ${division}`;
}

function PlayerCard({ player, side, showOpggLink }: { player: Player | undefined; side: 'my' | 'enemy'; showOpggLink?: boolean }) {
  const roleInfo = ROLES.find((r) => r.value === player?.role);
  const { getRank } = useRankStore();
  const { findPool } = usePlayerPoolStore();
  const { openPlayerProfile } = useOpgg();

  // Get rank from store
  const cachedRank = player?.summonerName && player?.tagLine
    ? getRank({ summonerName: player.summonerName, tagLine: player.tagLine, region: player.region })
    : null;

  const rankDisplay = useMemo(() => {
    if (!cachedRank?.rank) return { text: '-', color: 'text-gray-600' };
    const { tier, division, lp } = cachedRank.rank;
    return {
      text: formatRank(tier, division, lp),
      color: RANK_COLORS[tier] || 'text-gray-400',
    };
  }, [cachedRank]);

  // Get champion IDs from player pool
  const championIds = useMemo(() => {
    if (!player) return [];
    const pool = player.summonerName ? findPool(player.summonerName, player.role) : null;
    const groups = pool?.championGroups || player.championGroups || [];
    const fromGroups = groups.flatMap((g) => g.championIds);
    const fromPool = player.championPool?.map((c) => c.championId) || [];
    // Combine and dedupe
    return [...new Set([...fromGroups, ...fromPool])];
  }, [player, findPool]);

  if (!player) {
    return (
      <div className={`flex items-center gap-3 p-2 rounded-lg bg-lol-dark/50 ${
        side === 'enemy' ? 'flex-row-reverse text-right' : ''
      }`}>
        <div className="w-8 h-8 rounded-full bg-lol-surface flex items-center justify-center text-gray-600">
          ?
        </div>
        <div className="flex-1">
          <div className="text-gray-600 text-sm">No player</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 p-2 rounded-lg bg-lol-dark hover:bg-lol-surface transition-colors ${
      side === 'enemy' ? 'flex-row-reverse text-right' : ''
    }`}>
      {/* Role Icon */}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
        side === 'my' ? 'bg-blue-500/20 text-blue-400' : 'bg-red-500/20 text-red-400'
      }`}>
        {roleInfo?.label.slice(0, 3) || player.role.slice(0, 3).toUpperCase()}
      </div>

      {/* Player Info */}
      <div className="flex-1 min-w-0">
        <div className={`flex items-center gap-2 ${side === 'enemy' ? 'justify-end' : ''}`}>
          {showOpggLink && side === 'enemy' && player.summonerName && (
            <button
              onClick={() => openPlayerProfile(player)}
              className="p-1 rounded hover:bg-lol-surface text-gray-500 hover:text-lol-gold transition-colors shrink-0"
              title="Open OP.GG profile"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </button>
          )}
          <span className="text-white text-sm font-medium truncate">
            {player.summonerName || 'Unknown'}
          </span>
          <span className={`text-xs ${rankDisplay.color} shrink-0`}>
            {rankDisplay.text}
          </span>
        </div>
        {/* Champion Pool */}
        {championIds.length > 0 && (
          <div className={`flex gap-0.5 mt-1 ${side === 'enemy' ? 'justify-end' : ''}`}>
            {championIds.slice(0, 6).map((champId) => (
              <ChampionIcon key={champId} championId={champId} size="xs" />
            ))}
            {championIds.length > 6 && (
              <span className="text-[10px] text-gray-500 self-center ml-1">
                +{championIds.length - 6}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function EnemyTeamSearch({
  teams,
  selectedTeamId,
  onSelect,
}: {
  teams: Team[];
  selectedTeamId: string | null;
  onSelect: (teamId: string | null) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredTeams = useMemo(() => {
    if (!search.trim()) return teams;
    const lower = search.toLowerCase();
    return teams.filter((t) => t.name.toLowerCase().includes(lower));
  }, [teams, search]);

  const selectedTeam = teams.find((t) => t.id === selectedTeamId);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`px-4 py-2 rounded-lg border text-left transition-all flex items-center gap-3 ${
          selectedTeam
            ? 'bg-red-500/10 border-red-500/50 text-red-400'
            : 'bg-lol-dark border-lol-border text-gray-400 hover:border-lol-border-light'
        }`}
      >
        <span className="font-medium">
          {selectedTeam ? selectedTeam.name : 'Select enemy...'}
        </span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute top-full right-0 mt-2 min-w-50 bg-lol-card border border-lol-border rounded-xl shadow-xl z-20 overflow-hidden">
            {/* Search */}
            <div className="p-2 border-b border-lol-border">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search teams..."
                className="w-full px-3 py-2 bg-lol-dark border border-lol-border rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-lol-gold/50"
                autoFocus
              />
            </div>

            {/* Options */}
            <div className="max-h-64 overflow-y-auto">
              <button
                onClick={() => {
                  onSelect(null);
                  setIsOpen(false);
                  setSearch('');
                }}
                className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${
                  !selectedTeamId
                    ? 'bg-lol-surface text-white'
                    : 'text-gray-400 hover:bg-lol-dark hover:text-white'
                }`}
              >
                No enemy team
              </button>

              {filteredTeams.length === 0 ? (
                <div className="px-4 py-3 text-gray-500 text-sm text-center">
                  No teams found
                </div>
              ) : (
                filteredTeams.map((team) => (
                  <button
                    key={team.id}
                    onClick={() => {
                      onSelect(team.id);
                      setIsOpen(false);
                      setSearch('');
                    }}
                    className={`w-full px-4 py-2.5 text-left text-sm transition-colors flex items-center justify-between ${
                      selectedTeamId === team.id
                        ? 'bg-red-500/10 text-red-400'
                        : 'text-gray-300 hover:bg-lol-dark hover:text-white'
                    }`}
                  >
                    <span>{team.name}</span>
                    <span className="text-xs text-gray-500">
                      {team.players.filter((p) => p.summonerName).length} players
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function TeamVsDisplay({
  myTeam,
  enemyTeam,
  selectedEnemyTeamId,
  onSelectEnemyTeam,
}: TeamVsDisplayProps) {
  const { teams: enemyTeams } = useEnemyTeamStore();
  const { fetchRanksFromCache } = useRankStore();
  const { openMultiSearch } = useOpgg();
  const mainRoles: Role[] = ['top', 'jungle', 'mid', 'adc', 'support'];

  const enemyRegion = enemyTeam?.players[0]?.region || DEFAULT_REGION;
  const hasValidEnemyPlayers = enemyTeam?.players.some((p) => p.summonerName);

  // Fetch ranks from cache when teams change
  useEffect(() => {
    const allPlayers = [
      ...myTeam.players.filter((p) => p.summonerName && p.tagLine),
      ...(enemyTeam?.players.filter((p) => p.summonerName && p.tagLine) || []),
    ].map((p) => ({
      summonerName: p.summonerName!,
      tagLine: p.tagLine!,
      region: p.region,
    }));

    if (allPlayers.length > 0) {
      fetchRanksFromCache(allPlayers);
    }
  }, [myTeam, enemyTeam, fetchRanksFromCache]);

  const getPlayerByRole = (team: Team | null, role: Role): Player | undefined => {
    return team?.players.find((p) => p.role === role && !p.isSub);
  };

  return (
    <div className="bg-lol-card border border-lol-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 p-4 border-b border-lol-border bg-lol-dark/50">
        {/* My Team */}
        <div className="flex flex-col items-start">
          <div className="text-blue-400 text-xs font-medium uppercase tracking-wide mb-1">
            My Team
          </div>
          <div className="px-4 py-2 rounded-lg border bg-blue-500/10 border-blue-500/50 text-blue-400 font-medium">
            {myTeam.name || 'My Team'}
          </div>
        </div>

        {/* VS Badge */}
        <div className="size-15 rounded-sm bg-lol-dark flex items-center justify-center">
          <span className="text-white font-bold text-sm">VS</span>
        </div>

        {/* Enemy Team Selector */}
        <div className="flex flex-col items-end">
          <div className="text-red-400 text-xs font-medium uppercase tracking-wide mb-1">
            Enemy Team
          </div>
          <div className="flex items-center gap-2">
            <EnemyTeamSearch
              teams={enemyTeams}
              selectedTeamId={selectedEnemyTeamId}
              onSelect={onSelectEnemyTeam}
            />
            {hasValidEnemyPlayers && (
              <button
                onClick={() => openMultiSearch(enemyTeam!.players, enemyRegion)}
                className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/50 text-red-400 hover:bg-red-500/20 hover:border-red-500 transition-all flex items-center gap-1.5 text-sm font-medium"
                title="Open OP.GG Multi-Search"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                OP.GG
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Players Grid */}
      <div className="p-4">
        <div className="space-y-2">
          {mainRoles.map((role) => {
            const myPlayer = getPlayerByRole(myTeam, role);
            const enemyPlayer = getPlayerByRole(enemyTeam, role);
            const roleInfo = ROLES.find((r) => r.value === role);

            return (
              <div key={role} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                {/* My Player */}
                <PlayerCard player={myPlayer} side="my" />

                {/* Role Divider */}
                <div className="w-16 flex items-center justify-center">
                  <div className="px-2 py-1 bg-lol-surface rounded text-xs text-gray-400 font-medium">
                    {roleInfo?.label || role}
                  </div>
                </div>

                {/* Enemy Player */}
                <PlayerCard player={enemyPlayer} side="enemy" showOpggLink />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
