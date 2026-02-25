import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDraftStore } from '../stores/useDraftStore';
import { useEnemyTeamStore } from '../stores/useEnemyTeamStore';
import { useMyTeamStore } from '../stores/useMyTeamStore';
import { useTierLimits, FREE_TIER_MAX_DRAFTS } from '../stores/useAuthStore';
import { Button, Card, ConfirmationModal, Input, Modal } from '../components/ui';

export default function DraftListPage() {
  const navigate = useNavigate();
  const { sessions, createSession, deleteSession } = useDraftStore();
  const { teams: enemyTeams, getTeam } = useEnemyTeamStore();
  const { selectedTeamId: myTeamId } = useMyTeamStore();
  const { isFreeTier, maxDrafts } = useTierLimits();

  const isAtDraftLimit = isFreeTier && sessions.length >= maxDrafts;
  const draftsRemaining = Math.max(0, maxDrafts - sessions.length);

  const [isNewSessionModalOpen, setIsNewSessionModalOpen] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');
  const [selectedEnemyTeamId, setSelectedEnemyTeamId] = useState('');
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);

  const handleCreateSession = () => {
    if (newSessionName.trim() && !isAtDraftLimit) {
      const session = createSession(
        newSessionName.trim(),
        selectedEnemyTeamId || undefined,
        myTeamId || undefined
      );
      setNewSessionName('');
      setSelectedEnemyTeamId('');
      setIsNewSessionModalOpen(false);
      // Navigate to the new draft
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

  const sortedSessions = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        {isAtDraftLimit ? (
          <Link
            to="/profile"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-lol-gold/10 border border-lol-gold/50 text-lol-gold hover:bg-lol-gold/20 transition-all font-medium"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
            Need more drafts? Upgrade to Pro
          </Link>
        ) : (
          <Button onClick={() => setIsNewSessionModalOpen(true)} size="lg">
            + New Draft
          </Button>
        )}
        <div>
          <h1 className="text-3xl font-bold text-white">Draft Planning</h1>
          <p className="text-gray-400 mt-1">
            Prepare for your next match
            {isFreeTier && (
              <span className="ml-2 text-gray-500">
                ({sessions.length}/{FREE_TIER_MAX_DRAFTS} drafts)
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Draft Sessions Grid */}
      {sortedSessions.length === 0 ? (
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
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sortedSessions.map((session) => {
            const enemyTeam = session.enemyTeamId ? getTeam(session.enemyTeamId) : null;
            return (
              <div
                key={session.id}
                onClick={() => navigate(`/draft/${session.id}`)}
                className="group relative p-5 rounded-xl border bg-lol-card border-lol-border hover:border-lol-gold/50 hover:bg-lol-card-hover cursor-pointer transition-all duration-200"
              >
                {/* Delete button */}
                <button
                  onClick={(e) => handleDeleteSession(e, session.id)}
                  className="absolute top-3 right-3 p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>

                <h3 className="text-lg font-semibold text-white mb-2 pr-8 truncate">
                  {session.name}
                </h3>

                {enemyTeam && (
                  <div className="flex items-center gap-2 text-sm text-red-400 mb-3">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    vs {enemyTeam.name}
                  </div>
                )}

                <div className="flex flex-wrap gap-2 mb-4">
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
