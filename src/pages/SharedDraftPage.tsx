import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { shareService } from '../lib/shareService';
import { SharedDraftData } from '../types/database';
import { Card } from '../components/ui';
import { getChampionIconUrlDefault, getChampionById } from '../lib/datadragon';

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
  const priorities = (draft.our_priorities || []) as { championId: string; role: string; priority: string; notes?: string }[];
  const contestedPicks = draft.contested_picks || [];
  const potentialBans = draft.potential_bans || [];

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
        {/* Title */}
        <div>
          <h1 className="text-3xl font-bold text-white">{draft.name}</h1>
          {enemyTeam && (
            <p className="text-red-400 mt-1">vs {enemyTeam.team.name}</p>
          )}
          <p className="text-gray-500 text-sm mt-2">
            Shared draft - Read only view
          </p>
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

        {/* Bans & Contested */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Potential Bans */}
          <Card variant="bordered" padding="md">
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
              Ban Targets ({potentialBans.length})
            </h2>
            {potentialBans.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {potentialBans.map((championId) => (
                  <ChampionBadge key={championId} championId={championId} variant="ban" />
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No ban targets set</p>
            )}
          </Card>

          {/* Contested Picks */}
          <Card variant="bordered" padding="md">
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Contested Picks ({contestedPicks.length})
            </h2>
            {contestedPicks.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {contestedPicks.map((championId) => (
                  <ChampionBadge key={championId} championId={championId} variant="contested" />
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No contested picks marked</p>
            )}
          </Card>
        </div>

        {/* Our Priorities */}
        <Card variant="bordered" padding="md">
          <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
            Our Priorities ({priorities.length})
          </h2>
          {priorities.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {priorities.map((p) => (
                <PriorityCard key={p.championId} priority={p} />
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No priorities set</p>
          )}
        </Card>

        {/* Notes */}
        {draft.notes && (
          <Card variant="bordered" padding="md">
            <h2 className="text-lg font-semibold text-white mb-3">Notes</h2>
            <p className="text-gray-300 whitespace-pre-wrap">{draft.notes}</p>
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
                      {groups.flatMap(g => g.championIds).slice(0, 15).map((champId) => (
                        <ChampionBadge key={champId} championId={champId} size="sm" />
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
  variant?: 'default' | 'ban' | 'contested';
  size?: 'sm' | 'md';
}

function ChampionBadge({ championId, variant = 'default', size = 'md' }: ChampionBadgeProps) {
  const champion = getChampionById(championId);
  const iconUrl = getChampionIconUrlDefault(championId);

  const sizeClasses = size === 'sm' ? 'w-8 h-8' : 'w-10 h-10';
  const borderClasses = {
    default: 'border-lol-border',
    ban: 'border-red-500/50',
    contested: 'border-yellow-500/50',
  }[variant];

  return (
    <div className="group relative" title={champion?.name || championId}>
      <img
        src={iconUrl}
        alt={champion?.name || championId}
        className={`${sizeClasses} rounded-lg border ${borderClasses} object-cover`}
      />
      {variant === 'ban' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <svg className="w-full h-full text-red-500/70" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none">
            <line x1="4" y1="4" x2="20" y2="20" />
          </svg>
        </div>
      )}
    </div>
  );
}

interface PriorityCardProps {
  priority: {
    championId: string;
    role: string;
    priority: string;
    notes?: string;
  };
}

function PriorityCard({ priority }: PriorityCardProps) {
  const champion = getChampionById(priority.championId);
  const iconUrl = getChampionIconUrlDefault(priority.championId);

  const priorityColors = {
    high: 'bg-red-500/20 text-red-400 border-red-500/30',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  };

  return (
    <div className="flex items-start gap-3 p-3 bg-lol-surface rounded-lg">
      <img
        src={iconUrl}
        alt={champion?.name || priority.championId}
        className="w-12 h-12 rounded-lg border border-lol-border"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-white truncate">
            {champion?.name || priority.championId}
          </span>
          <span className={`px-1.5 py-0.5 rounded text-xs font-medium border ${priorityColors[priority.priority as keyof typeof priorityColors] || priorityColors.medium}`}>
            {priority.priority}
          </span>
        </div>
        <div className="text-xs text-gray-500 uppercase mt-0.5">{priority.role}</div>
        {priority.notes && (
          <p className="text-xs text-gray-400 mt-1 truncate">{priority.notes}</p>
        )}
      </div>
    </div>
  );
}
