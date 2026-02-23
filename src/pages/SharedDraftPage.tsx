import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { shareService } from '../lib/shareService';
import { SharedDraftData, DbPlayer, DbEnemyPlayer } from '../types/database';
import { Card } from '../components/ui';
import { ChampionIcon } from '../components/champion';
import { useChampionData } from '../hooks/useChampionData';
import { ROLES, Role, Note } from '../types';

export default function SharedDraftPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<SharedDraftData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      loadSharedDraft(token);
    }
  }, [token]);

  const loadSharedDraft = async (shareToken: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await shareService.getSharedDraft(shareToken);
      console.log('Shared draft result:', result);
      console.log('Draft my_team_id:', result?.draft?.my_team_id);
      console.log('MyTeam from result:', result?.myTeam);
      console.log('MyTeam players:', result?.myTeam?.players);
      console.log('MyTeam players count:', result?.myTeam?.players?.length);
      if (!result) {
        setError('This share link is invalid or has expired.');
      } else {
        setData(result);
      }
    } catch (err) {
      setError('Failed to load shared draft. Please try again later.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-lol-gray flex items-center justify-center">
        <div className="text-center">
          <svg className="animate-spin h-10 w-10 text-lol-gold mx-auto mb-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-gray-400">Loading draft...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-lol-gray flex items-center justify-center p-4">
        <Card variant="bordered" padding="lg" className="max-w-md w-full text-center">
          <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h1 className="text-xl font-bold text-white mb-2">Link Not Found</h1>
          <p className="text-gray-400 mb-6">{error}</p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-4 py-2 bg-lol-gold/10 hover:bg-lol-gold/20 text-lol-gold rounded-lg transition-colors"
          >
            Go to Teamcomp.lol
          </Link>
        </Card>
      </div>
    );
  }

  const { draft, enemyTeam, myTeam, shareInfo } = data;

  // Read from groups (source of truth) with fallback to legacy flat arrays
  const banGroups = (draft.ban_groups || []) as { id: string; name: string; championIds: string[] }[];
  const priorityGroups = (draft.priority_groups || []) as { id: string; name: string; championIds: string[] }[];

  // Flatten groups to get all champion IDs (for backwards compatibility display)
  const potentialBans = banGroups.length > 0
    ? banGroups.flatMap(g => g.championIds)
    : (draft.potential_bans || []) as string[];
  const priorities = priorityGroups.length > 0
    ? priorityGroups.flatMap(g => g.championIds)
    : (draft.priority_picks || []) as string[];
  const notepad = (draft.notepad || []) as Note[];

  return (
    <div className="min-h-screen bg-lol-gray">
      {/* Header */}
      <header className="bg-lol-dark border-b border-lol-border">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-lol-gold font-bold">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-lol-gold-light to-lol-gold flex items-center justify-center text-lol-dark font-bold text-sm">
              TC
            </div>
            <span>Teamcomp.lol</span>
          </Link>
          <div className="text-sm text-gray-500 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            {shareInfo.viewCount} views
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* VS Team Bar */}
        <Card variant="bordered" padding="md">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-white">{draft.name}</h1>
              <p className="text-gray-500 text-sm mt-1">Shared draft - Read only</p>
            </div>
            {myTeam && enemyTeam && (
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-blue-400 font-semibold">{myTeam.team.name}</p>
                  <p className="text-xs text-gray-500">{myTeam.players.filter(p => !p.is_sub).length} players</p>
                </div>
                <div className="px-4 py-2 bg-lol-surface rounded-lg">
                  <span className="text-xl font-bold text-gray-400">VS</span>
                </div>
                <div className="text-left">
                  <p className="text-red-400 font-semibold">{enemyTeam.team.name}</p>
                  <p className="text-xs text-gray-500">{enemyTeam.players.filter(p => !p.is_sub).length} players</p>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Team VS Display - Players by Role */}
        {(myTeam || enemyTeam) && (
          <SharedTeamVsDisplay myTeam={myTeam} enemyTeam={enemyTeam} />
        )}

        {/* Contested Picks */}
        {myTeam && enemyTeam && (
          <ContestedPicksSection myTeam={myTeam} enemyTeam={enemyTeam} />
        )}

        {/* Bans & Priorities - Grouped Display */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
          {/* Ban Groups */}
          <GroupedChampionDisplay
            title="Bans"
            groups={banGroups}
            variant="ban"
            fallbackChampions={potentialBans}
          />

          {/* Priority Groups */}
          <GroupedChampionDisplay
            title="Our priorities"
            groups={priorityGroups}
            variant="priority"
            fallbackChampions={priorities}
          />
        </div>

        {/* Teams Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* My Team */}
          {myTeam && (
            <Card variant="bordered" padding="md">
              <h2 className="text-lg font-semibold text-blue-400 mb-3 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {myTeam.team.name}
              </h2>
              <div className="space-y-2">
                {myTeam.players.filter(p => !p.is_sub).map((player) => (
                  <div key={player.id} className="flex items-center gap-3 text-sm">
                    <span className="w-16 text-gray-500 uppercase text-xs">{player.role}</span>
                    <span className="text-white">{player.summoner_name}</span>
                    <span className="text-gray-600">#{player.tag_line}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Enemy Team */}
          {enemyTeam && (
            <Card variant="bordered" padding="md">
              <h2 className="text-lg font-semibold text-red-400 mb-3 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {enemyTeam.team.name}
              </h2>
              <div className="space-y-2">
                {enemyTeam.players.filter(p => !p.is_sub).map((player) => (
                  <div key={player.id} className="flex items-center gap-3 text-sm">
                    <span className="w-16 text-gray-500 uppercase text-xs">{player.role}</span>
                    <span className="text-white">{player.summoner_name}</span>
                    <span className="text-gray-600">#{player.tag_line}</span>
                  </div>
                ))}
              </div>
              {enemyTeam.team.notes && (
                <div className="mt-3 pt-3 border-t border-lol-border">
                  <p className="text-sm text-gray-400">{enemyTeam.team.notes}</p>
                </div>
              )}
            </Card>
          )}
        </div>

        {/* Draft Notes (single text) */}
        {draft.notes && (
          <Card variant="bordered" padding="md">
            <h2 className="text-lg font-semibold text-white mb-3">Draft Notes</h2>
            <p className="text-gray-300 whitespace-pre-wrap">{draft.notes}</p>
          </Card>
        )}

        {/* Notepad Cards */}
        {notepad.length > 0 && (
          <Card variant="bordered" padding="md">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-lol-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Notepad ({notepad.length})
            </h2>
            <div className="flex flex-wrap gap-3">
              {notepad.map((note) => (
                <div
                  key={note.id}
                  className="w-[calc((100%-1.5rem)/3)] min-w-48 bg-lol-dark rounded-xl border border-lol-border/50 p-3"
                >
                  <p className="text-sm text-gray-300 whitespace-pre-wrap">{note.content || <span className="text-gray-600 italic">Empty note</span>}</p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Enemy Champion Pools */}
        {enemyTeam && (
          <Card variant="bordered" padding="md">
            <h2 className="text-lg font-semibold text-white mb-4">Enemy Champion Pools</h2>
            <div className="space-y-4">
              {enemyTeam.players.filter(p => !p.is_sub).map((player) => {
                const groups = (player.champion_groups || []) as { id: string; name: string; championIds: string[] }[];
                const hasChampions = groups.some(g => g.championIds.length > 0);

                if (!hasChampions) return null;

                return (
                  <div key={player.id} className="p-3 bg-lol-surface rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-medium text-gray-500 uppercase w-14">{player.role}</span>
                      <span className="text-white font-medium">{player.summoner_name}</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {groups.flatMap(g => g.championIds).slice(0, 15).map((champId, idx) => (
                        <ChampionBadge key={`${champId}-${idx}`} championId={champId} size="sm" />
                      ))}
                      {groups.flatMap(g => g.championIds).length > 15 && (
                        <span className="text-xs text-gray-500 self-center ml-1">
                          +{groups.flatMap(g => g.championIds).length - 15} more
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center pt-4 pb-8 text-gray-500 text-sm">
          <p>
            Create your own draft sheets at{' '}
            <Link to="/" className="text-lol-gold hover:underline">
              Teamcomp.lol
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}

interface ChampionBadgeProps {
  championId: string;
  variant?: 'default' | 'ban' | 'priority';
  size?: 'sm' | 'md';
}

function ChampionBadge({ championId, variant = 'default', size = 'md' }: ChampionBadgeProps) {
  const { getChampionById } = useChampionData();
  const champion = getChampionById(championId);

  const borderClasses = {
    default: 'border-lol-border',
    ban: 'border-red-500/50',
    priority: 'border-lol-gold/50',
  }[variant];

  return (
    <div
      className={`flex items-center gap-2 px-2 py-1 bg-lol-surface rounded-lg border ${borderClasses}`}
      title={champion?.name || championId}
    >
      <ChampionIcon championId={championId} size={size} />
      <span className="text-sm text-gray-300">{champion?.name || championId}</span>
    </div>
  );
}

// Read-only grouped champion display for shared drafts
interface GroupedChampionDisplayProps {
  title: string;
  groups: { id: string; name: string; championIds: string[] }[];
  variant: 'ban' | 'priority';
  fallbackChampions: string[];
}

function GroupedChampionDisplay({ title, groups, variant, fallbackChampions }: GroupedChampionDisplayProps) {
  const colors = variant === 'ban'
    ? { text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', headerBg: 'bg-red-500/5' }
    : { text: 'text-lol-gold', bg: 'bg-lol-gold/10', border: 'border-lol-gold/30', headerBg: 'bg-lol-gold/5' };

  const totalCount = groups.length > 0
    ? groups.reduce((acc, g) => acc + g.championIds.length, 0)
    : fallbackChampions.length;

  const icon = variant === 'ban' ? (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
    </svg>
  ) : (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  );

  // If we have groups, show grouped display
  if (groups.length > 0) {
    return (
      <Card variant="bordered" padding="md" className="h-full">
        <h3 className={`text-lg font-semibold ${colors.text} mb-3 flex items-center gap-2`}>
          {icon}
          {title} ({totalCount})
        </h3>

        <div className="space-y-3">
          {groups.map((group) => (
            <div
              key={group.id}
              className={`rounded-lg border ${colors.border} ${colors.headerBg}`}
            >
              {/* Group header */}
              <div className="flex items-center justify-between px-3 py-2 border-b border-lol-border/30">
                <span className={`text-sm font-medium ${colors.text}`}>
                  {group.name}
                  <span className="text-gray-500 ml-2">({group.championIds.length})</span>
                </span>
              </div>

              {/* Group champions */}
              <div className="p-2 min-h-12">
                {group.championIds.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {group.championIds.map((championId, idx) => (
                      <ChampionBadge
                        key={`${group.id}-${championId}-${idx}`}
                        championId={championId}
                        variant={variant}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm py-2 text-center">Empty group</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  // Fallback: show flat list (for legacy data)
  return (
    <Card variant="bordered" padding="md" className="h-full">
      <h3 className={`text-lg font-semibold ${colors.text} mb-3 flex items-center gap-2`}>
        {icon}
        {title} ({totalCount})
      </h3>
      {fallbackChampions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {fallbackChampions.map((championId, idx) => (
            <ChampionBadge key={`${championId}-${idx}`} championId={championId} variant={variant} />
          ))}
        </div>
      ) : (
        <p className="text-gray-500 text-sm">No {variant === 'ban' ? 'ban targets' : 'priorities'} set</p>
      )}
    </Card>
  );
}

// Shared Player Card with champion pool display
interface SharedPlayerCardProps {
  player: DbPlayer | DbEnemyPlayer | undefined;
  side: 'my' | 'enemy';
  roleLabel: string;
  hasTeam: boolean;
}

function SharedPlayerCard({ player, side, roleLabel, hasTeam }: SharedPlayerCardProps) {
  // Get champion IDs from player's champion groups
  const championIds = useMemo(() => {
    if (!player) return [];
    const groups = (player.champion_groups || []) as { id: string; name: string; championIds: string[] }[];
    return groups.flatMap(g => g.championIds);
  }, [player]);

  if (!player) {
    return (
      <div className={`flex items-center gap-3 p-2 rounded-lg bg-lol-dark/50 ${
        side === 'enemy' ? 'flex-row-reverse text-right' : ''
      }`}>
        <div className="w-8 h-8 rounded-full bg-lol-surface flex items-center justify-center text-gray-600">
          ?
        </div>
        <div className="flex-1">
          <div className="text-gray-600 text-sm">{hasTeam ? 'Unknown' : '-'}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 p-2 rounded-lg bg-lol-dark ${
      side === 'enemy' ? 'flex-row-reverse text-right' : ''
    }`}>
      {/* Role Icon */}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
        side === 'my' ? 'bg-blue-500/20 text-blue-400' : 'bg-red-500/20 text-red-400'
      }`}>
        {roleLabel.slice(0, 3)}
      </div>

      {/* Player Info */}
      <div className="flex-1 min-w-0">
        <div className={`flex items-center gap-2 ${side === 'enemy' ? 'justify-end' : ''}`}>
          <span className="text-white text-sm font-medium truncate">
            {player.summoner_name || 'Unknown'}
          </span>
          {player.tag_line && (
            <span className="text-gray-500 text-xs shrink-0">#{player.tag_line}</span>
          )}
        </div>
        {/* Champion Pool */}
        {championIds.length > 0 && (
          <div className={`flex gap-0.5 mt-1 ${side === 'enemy' ? 'justify-end' : ''}`}>
            {championIds.slice(0, 6).map((champId, idx) => (
              <ChampionIcon key={`${champId}-${idx}`} championId={champId} size="xs" />
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

// Read-only Team VS Display for shared drafts
interface SharedTeamVsDisplayProps {
  myTeam: SharedDraftData['myTeam'];
  enemyTeam: SharedDraftData['enemyTeam'];
}

function SharedTeamVsDisplay({ myTeam, enemyTeam }: SharedTeamVsDisplayProps) {
  const mainRoles: Role[] = ['top', 'jungle', 'mid', 'adc', 'support'];

  const getPlayerByRole = (players: (DbPlayer | DbEnemyPlayer)[] | undefined, role: Role) => {
    return players?.find((p) => p.role === role && !p.is_sub);
  };

  const getRoleLabel = (role: Role) => {
    return ROLES.find((r) => r.value === role)?.label || role;
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
            {myTeam?.team.name || 'My Team'}
          </div>
        </div>

        {/* VS Badge */}
        <div className="size-15 rounded-sm bg-lol-dark flex items-center justify-center">
          <span className="text-white font-bold text-sm">VS</span>
        </div>

        {/* Enemy Team */}
        <div className="flex flex-col items-end">
          <div className="text-red-400 text-xs font-medium uppercase tracking-wide mb-1">
            Enemy Team
          </div>
          <div className="px-4 py-2 rounded-lg border bg-red-500/10 border-red-500/50 text-red-400 font-medium">
            {enemyTeam?.team.name || 'Enemy Team'}
          </div>
        </div>
      </div>

      {/* Players Grid */}
      <div className="p-4">
        <div className="space-y-2">
          {mainRoles.map((role) => {
            const myPlayer = getPlayerByRole(myTeam?.players, role);
            const enemyPlayer = getPlayerByRole(enemyTeam?.players, role);
            const roleLabel = getRoleLabel(role);

            return (
              <div key={role} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                {/* My Player */}
                <SharedPlayerCard
                  player={myPlayer}
                  side="my"
                  roleLabel={roleLabel}
                  hasTeam={!!myTeam}
                />

                {/* Role Divider */}
                <div className="w-16 flex items-center justify-center">
                  <div className="px-2 py-1 bg-lol-surface rounded text-xs text-gray-400 font-medium">
                    {roleLabel}
                  </div>
                </div>

                {/* Enemy Player */}
                <SharedPlayerCard
                  player={enemyPlayer}
                  side="enemy"
                  roleLabel={roleLabel}
                  hasTeam={!!enemyTeam}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Contested Picks Section for shared drafts
interface ContestedPicksSectionProps {
  myTeam: NonNullable<SharedDraftData['myTeam']>;
  enemyTeam: NonNullable<SharedDraftData['enemyTeam']>;
}

function ContestedPicksSection({ myTeam, enemyTeam }: ContestedPicksSectionProps) {
  const { getChampionById } = useChampionData();

  // Calculate contested picks from both teams' champion pools
  const contestedPicks = useMemo(() => {
    // Get all champion IDs from my team's players
    const myChampionIds = new Set<string>();
    myTeam.players.forEach((player) => {
      const groups = (player.champion_groups || []) as { id: string; name: string; championIds: string[] }[];
      groups.forEach((g) => g.championIds.forEach((id) => myChampionIds.add(id)));
    });

    // Get all champion IDs from enemy team's players
    const enemyChampionIds = new Set<string>();
    enemyTeam.players.forEach((player) => {
      const groups = (player.champion_groups || []) as { id: string; name: string; championIds: string[] }[];
      groups.forEach((g) => g.championIds.forEach((id) => enemyChampionIds.add(id)));
    });

    // Find intersection
    const contested: string[] = [];
    myChampionIds.forEach((id) => {
      if (enemyChampionIds.has(id)) {
        contested.push(id);
      }
    });

    return contested;
  }, [myTeam, enemyTeam]);

  if (contestedPicks.length === 0) {
    return null;
  }

  return (
    <Card variant="bordered" padding="md">
      <h2 className="text-lg font-semibold text-yellow-400 mb-3 flex items-center gap-2">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        Contested Picks ({contestedPicks.length})
      </h2>
      <p className="text-xs text-gray-500 mb-3">Champions both teams want</p>
      <div className="flex flex-wrap gap-2">
        {contestedPicks.map((championId) => {
          const champion = getChampionById(championId);
          return (
            <div
              key={championId}
              className="flex items-center gap-2 px-2 py-1 bg-lol-surface rounded-lg border border-yellow-500/50"
            >
              <ChampionIcon championId={championId} size="sm" />
              <span className="text-sm text-gray-300">{champion?.name || championId}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

