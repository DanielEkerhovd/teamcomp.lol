import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDraftStore } from '../stores/useDraftStore';
import { useEnemyTeamStore } from '../stores/useEnemyTeamStore';
import { useMyTeamStore } from '../stores/useMyTeamStore';
import { useTierLimits } from '../stores/useAuthStore';
import { Button, Card, ConfirmationModal, Input, Modal } from '../components/ui';

type DraftFilter = 'all' | 'personal' | string; // string = teamId for team-specific filter

export default function DraftListPage() {
  const navigate = useNavigate();
  const { sessions, createSession, deleteSession, toggleFavorite, togglePlanned } = useDraftStore();
  const { teams: enemyTeams, getTeam } = useEnemyTeamStore();
  const { teams: myTeams, selectedTeamId: myTeamId, memberships } = useMyTeamStore();
  const { maxDrafts } = useTierLimits();

  // Identify which teams have paid plans
  const paidTeamIds = useMemo(() => {
    const ids = new Set<string>();
    myTeams.forEach(t => {
      const dbTeam = t as typeof t & { hasTeamPlan?: boolean };
      if (dbTeam.hasTeamPlan) ids.add(t.id);
    });
    memberships.forEach(m => {
      if (m.hasTeamPlan) ids.add(m.teamId);
    });
    return ids;
  }, [myTeams, memberships]);

  // Split sessions into personal (counts toward limit) and team (unlimited)
  const personalSessions = useMemo(
    () => sessions.filter(s => !s.myTeamId || !paidTeamIds.has(s.myTeamId)),
    [sessions, paidTeamIds]
  );

  const isAtPersonalDraftLimit = personalSessions.length >= maxDrafts;

  // Get teams that have drafts (for filter tabs)
  const teamsWithDrafts = useMemo(() => {
    const teamIds = new Set<string>();
    sessions.forEach(s => {
      if (s.myTeamId && paidTeamIds.has(s.myTeamId)) {
        teamIds.add(s.myTeamId);
      }
    });
    return Array.from(teamIds).map(id => {
      const ownedTeam = myTeams.find(t => t.id === id);
      const membership = memberships.find(m => m.teamId === id);
      return { id, name: ownedTeam?.name || membership?.teamName || 'Team' };
    });
  }, [sessions, paidTeamIds, myTeams, memberships]);

  const [draftFilter, setDraftFilter] = useState<DraftFilter>('all');
  const [isNewSessionModalOpen, setIsNewSessionModalOpen] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');
  const [selectedEnemyTeamId, setSelectedEnemyTeamId] = useState('');
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showPlannedOnly, setShowPlannedOnly] = useState(false);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

  // When filtered to a paid team, drafts are unlimited (unless team is banned)
  const isCreatingTeamDraft = draftFilter !== 'all' && draftFilter !== 'personal' && paidTeamIds.has(draftFilter);
  const isFilteredTeamBanned = (() => {
    if (!isCreatingTeamDraft) return false;
    const ownedTeam = myTeams.find(t => t.id === draftFilter);
    if (ownedTeam?.bannedAt) return true;
    const membership = memberships.find(m => m.teamId === draftFilter);
    if ((membership as any)?.bannedAt) return true;
    return false;
  })();
  const canCreateDraft = (isCreatingTeamDraft && !isFilteredTeamBanned) || !isAtPersonalDraftLimit;

  const handleCreateSession = () => {
    if (newSessionName.trim() && canCreateDraft) {
      const teamId = isCreatingTeamDraft ? draftFilter : (myTeamId || undefined);
      const session = createSession(
        newSessionName.trim(),
        selectedEnemyTeamId || undefined,
        teamId
      );
      setNewSessionName('');
      setSelectedEnemyTeamId('');
      setIsNewSessionModalOpen(false);
      navigate(`/draft/${session.id}`);
    }
  };

  const handleDeleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSessionToDelete(id);
  };

  const confirmDeleteSession = () => {
    if (sessionToDelete) {
      deleteSession(sessionToDelete);
      setSessionToDelete(null);
    }
  };

  const filteredSessions = useMemo(() => {
    let filtered = sessions;

    if (draftFilter === 'personal') {
      filtered = filtered.filter(s => !s.myTeamId || !paidTeamIds.has(s.myTeamId));
    } else if (draftFilter !== 'all') {
      filtered = filtered.filter(s => s.myTeamId === draftFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(session => {
        const enemyTeam = session.enemyTeamId ? getTeam(session.enemyTeamId) : null;
        return (
          session.name.toLowerCase().includes(query) ||
          (enemyTeam?.name.toLowerCase().includes(query) ?? false)
        );
      });
    }

    if (showFavoritesOnly) {
      filtered = filtered.filter(s => s.isFavorite);
    }

    if (showPlannedOnly) {
      filtered = filtered.filter(s => s.isPlanned);
    }

    return [...filtered].sort((a, b) => {
      const aTime = a.updatedAt || 0;
      const bTime = b.updatedAt || 0;
      return sortOrder === 'newest' ? bTime - aTime : aTime - bTime;
    });
  }, [sessions, draftFilter, searchQuery, paidTeamIds, getTeam, showFavoritesOnly, showPlannedOnly, sortOrder]);

  // Counter text
  const counterText = useMemo(() => {
    if (draftFilter === 'all' || draftFilter === 'personal') {
      const teamDraftCount = sessions.length - personalSessions.length;
      const parts = [`${personalSessions.length}/${maxDrafts} personal`];
      if (teamDraftCount > 0) parts.push(`${teamDraftCount} team`);
      return parts.join(', ');
    }
    const teamSessions = sessions.filter(s => s.myTeamId === draftFilter);
    return `${teamSessions.length} team drafts (unlimited)`;
  }, [draftFilter, sessions, personalSessions, maxDrafts]);

  const showFilterTabs = teamsWithDrafts.length > 0 || paidTeamIds.size > 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Draft Planning</h1>
        <p className="text-gray-400 mt-1">
          Prepare for your next match
          <span className="ml-2 text-gray-500">({counterText})</span>
        </p>
      </div>

      {/* Filter tabs */}
      {showFilterTabs && (
        <div className="flex gap-2 flex-wrap">
          {(['all', 'personal'] as const).map(filter => (
            <button
              key={filter}
              onClick={() => setDraftFilter(filter)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                draftFilter === filter
                  ? 'bg-lol-gold/20 text-lol-gold border border-lol-gold/50'
                  : 'bg-lol-dark text-gray-400 border border-lol-border hover:text-white hover:border-lol-border-light'
              }`}
            >
              {filter === 'all' ? 'All' : `Personal (${personalSessions.length})`}
            </button>
          ))}
          {teamsWithDrafts.map(team => {
            const count = sessions.filter(s => s.myTeamId === team.id).length;
            return (
              <button
                key={team.id}
                onClick={() => setDraftFilter(team.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  draftFilter === team.id
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
                    : 'bg-lol-dark text-gray-400 border border-lol-border hover:text-white hover:border-lol-border-light'
                }`}
              >
                {team.name} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Action + Search bar */}
      {sessions.length > 0 && (
        <div className="flex gap-3 items-center">
          {isFilteredTeamBanned ? (
            <span className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 font-medium whitespace-nowrap cursor-not-allowed">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
              Team Banned
            </span>
          ) : !canCreateDraft ? (
            <Link
              to="/profile#plan"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-lol-gold/10 border border-lol-gold/50 text-lol-gold hover:bg-lol-gold/20 transition-all font-medium whitespace-nowrap"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
              Upgrade to Pro
            </Link>
          ) : (
            <Button onClick={() => setIsNewSessionModalOpen(true)}>
              + New Draft
            </Button>
          )}
          <div className="relative flex-1 max-w-md">
            <svg
              className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search drafts by name or enemy team..."
              className="w-full pl-11 pr-4 py-3 text-sm bg-lol-dark border border-lol-border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-lol-gold/50 focus:ring-2 focus:ring-lol-gold/20 transition-all duration-200"
            />
          </div>
          <button
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all duration-200 ${
              showFavoritesOnly
                ? 'bg-lol-gold/20 border-lol-gold text-lol-gold'
                : 'bg-lol-dark border-lol-border text-gray-400 hover:text-white hover:border-gray-500'
            }`}
          >
            <svg
              className="w-4 h-4"
              fill={showFavoritesOnly ? 'currentColor' : 'none'}
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
          <button
            onClick={() => setShowPlannedOnly(!showPlannedOnly)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all duration-200 ${
              showPlannedOnly
                ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                : 'bg-lol-dark border-lol-border text-gray-400 hover:text-white hover:border-gray-500'
            }`}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            Planned
          </button>
          <div className="flex items-center gap-1 bg-lol-dark border border-lol-border rounded-xl p-1">
            <button
              onClick={() => setSortOrder('newest')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all duration-200 ${
                sortOrder === 'newest'
                  ? 'bg-lol-surface text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
              </svg>
              Newest
            </button>
            <button
              onClick={() => setSortOrder('oldest')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all duration-200 ${
                sortOrder === 'oldest'
                  ? 'bg-lol-surface text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
              </svg>
              Oldest
            </button>
          </div>
        </div>
      )}

      {/* Draft Sessions Grid */}
      {filteredSessions.length === 0 ? (
        (searchQuery.trim() || showFavoritesOnly || showPlannedOnly) ? (
          <Card className="text-center py-8">
            <p className="text-gray-400">
              No drafts match your {searchQuery.trim() ? 'search' : ''}{(showFavoritesOnly || showPlannedOnly) ? `${searchQuery.trim() ? ' or ' : ''}filters` : ''}.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setShowFavoritesOnly(false);
                setShowPlannedOnly(false);
                setSortOrder('newest');
              }}
              className="mt-3 text-lol-gold hover:text-lol-gold-light transition-colors"
            >
              Clear filters
            </button>
          </Card>
        ) : (
          <Card className="text-center py-16">
            <div className="text-gray-500 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">No draft sessions yet</h2>
            <p className="text-gray-400 mb-6 max-w-md mx-auto">
              Create your first draft session to start planning picks and bans for your matches
            </p>
            <Button onClick={() => setIsNewSessionModalOpen(true)} size="lg">
              Create Your First Draft
            </Button>
          </Card>
        )
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredSessions.map((session) => {
            const enemyTeam = session.enemyTeamId ? getTeam(session.enemyTeamId) : null;
            const isTeamDraft = session.myTeamId && paidTeamIds.has(session.myTeamId);
            return (
              <div
                key={session.id}
                onClick={() => navigate(`/draft/${session.id}`)}
                className="group relative p-5 rounded-xl border bg-lol-card border-lol-border hover:border-lol-gold/50 hover:bg-lol-card-hover cursor-pointer transition-all duration-200"
              >
                {/* Action buttons */}
                <div className="absolute top-3 right-3 flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePlanned(session.id);
                    }}
                    className={`p-1.5 rounded-lg transition-all ${
                      session.isPlanned
                        ? 'text-blue-400'
                        : 'text-gray-500 hover:text-gray-400 opacity-0 group-hover:opacity-100'
                    }`}
                    title={session.isPlanned ? 'Remove from planned' : 'Mark as planned'}
                  >
                    <svg className="w-4 h-4" fill={session.isPlanned ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(session.id);
                    }}
                    className={`p-1.5 rounded-lg transition-all ${
                      session.isFavorite
                        ? 'text-lol-gold'
                        : 'text-gray-500 hover:text-gray-400 opacity-0 group-hover:opacity-100'
                    }`}
                  >
                    <svg className="w-4 h-4" fill={session.isFavorite ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => handleDeleteSession(e, session.id)}
                    className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>

                <h3 className="text-lg font-semibold text-white mb-2 pr-16 truncate">
                  {session.name}
                </h3>

                {/* Team badge for team drafts in "All" view */}
                {isTeamDraft && draftFilter === 'all' && (
                  <div className="flex items-center gap-1.5 text-xs text-blue-400 mb-2">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {myTeams.find(t => t.id === session.myTeamId)?.name
                      || memberships.find(m => m.teamId === session.myTeamId)?.teamName
                      || 'Team'}
                  </div>
                )}

                {enemyTeam && (
                  <div className="flex items-center gap-2 text-sm text-red-400 mb-3">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    vs {enemyTeam.name}
                  </div>
                )}

                <div className="flex flex-wrap gap-2 mb-4">
                  {session.isPlanned && (
                    <span className="px-2 py-1 text-xs rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      Planned
                    </span>
                  )}
                  {(() => {
                    const banCount = (session.banGroups || []).reduce((sum, g) => sum + g.championIds.length, 0);
                    return banCount > 0 && (
                      <span className="px-2 py-1 text-xs rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
                        {banCount} bans
                      </span>
                    );
                  })()}
                  {(() => {
                    const priorityCount = (session.priorityGroups || []).reduce((sum, g) => sum + g.championIds.length, 0);
                    return priorityCount > 0 && (
                      <span className="px-2 py-1 text-xs rounded-lg bg-lol-gold/10 text-lol-gold border border-lol-gold/20">
                        {priorityCount} priorities
                      </span>
                    );
                  })()}
                </div>

                <div className="text-xs text-gray-500">
                  Updated {new Date(session.updatedAt).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New session modal */}
      <Modal
        isOpen={isNewSessionModalOpen}
        onClose={() => setIsNewSessionModalOpen(false)}
        title="New Draft Session"
      >
        <div className="space-y-6">
          <Input
            label="Session Name"
            value={newSessionName}
            onChange={(e) => setNewSessionName(e.target.value)}
            placeholder="e.g., Week 3 vs Team Liquid"
            autoFocus
            size="lg"
          />

          {/* Enemy Team Selector */}
          <div>
            <label className="text-sm font-medium text-gray-300 block mb-3">
              Enemy Team (optional)
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedEnemyTeamId('')}
                className={`
                  px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                  ${!selectedEnemyTeamId
                    ? 'bg-lol-surface border-2 border-lol-border-light text-white'
                    : 'bg-lol-dark border border-lol-border text-gray-400 hover:text-white hover:border-lol-border-light'
                  }
                `}
              >
                Select later
              </button>
              {enemyTeams.map((team) => {
                const isSelected = selectedEnemyTeamId === team.id;
                return (
                  <button
                    key={team.id}
                    onClick={() => setSelectedEnemyTeamId(team.id)}
                    className={`
                      px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                      ${isSelected
                        ? 'bg-red-500/20 border-2 border-red-500/50 text-red-400'
                        : 'bg-lol-dark border border-lol-border text-gray-400 hover:text-white hover:border-lol-border-light'
                      }
                    `}
                  >
                    {team.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <Button
              variant="ghost"
              onClick={() => setIsNewSessionModalOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateSession} disabled={!newSessionName.trim()}>
              Create
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete confirmation modal */}
      <ConfirmationModal
        isOpen={!!sessionToDelete}
        onClose={() => setSessionToDelete(null)}
        onConfirm={confirmDeleteSession}
        title="Delete Draft"
        message="Are you sure you want to delete this draft session?"
        confirmText="Delete"
      />
    </div>
  );
}
