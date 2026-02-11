import { useState } from 'react';
import { useDraftStore } from '../stores/useDraftStore';
import { useEnemyTeamStore } from '../stores/useEnemyTeamStore';
import { useMyTeamStore } from '../stores/useMyTeamStore';
import { Button, Card, Input, Modal } from '../components/ui';
import { OpggLinks } from '../components/team';
import { BanSection, ContestedPicks, PriorityList, DraftStatistics } from '../components/draft';

export default function DraftPage() {
  const {
    sessions,
    currentSessionId,
    createSession,
    updateSession,
    deleteSession,
    setCurrentSession,
    getCurrentSession,
    addContestedPick,
    removeContestedPick,
    addPotentialBan,
    removePotentialBan,
    addPriority,
    removePriority,
  } = useDraftStore();

  const { teams: enemyTeams, getTeam } = useEnemyTeamStore();
  const { teams: myTeams, selectedTeamId } = useMyTeamStore();
  const myTeam = myTeams.find((t) => t.id === selectedTeamId) || myTeams[0];

  const [isNewSessionModalOpen, setIsNewSessionModalOpen] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');
  const [selectedEnemyTeamId, setSelectedEnemyTeamId] = useState('');

  const currentSession = getCurrentSession();
  const currentEnemyTeam = currentSession?.enemyTeamId
    ? getTeam(currentSession.enemyTeamId)
    : null;

  const handleCreateSession = () => {
    if (newSessionName.trim()) {
      createSession(
        newSessionName.trim(),
        selectedEnemyTeamId || undefined
      );
      setNewSessionName('');
      setSelectedEnemyTeamId('');
      setIsNewSessionModalOpen(false);
    }
  };

  const handleDeleteSession = (id: string) => {
    if (confirm('Are you sure you want to delete this draft session?')) {
      deleteSession(id);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Draft Planning</h1>
          <p className="text-gray-400 mt-1">Prepare for your next match</p>
        </div>
        <Button onClick={() => setIsNewSessionModalOpen(true)} size="lg">
          + New Draft
        </Button>
      </div>

      {/* Session Selector - Card Based */}
      {sessions.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">
            Draft Sessions
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {sessions
              .sort((a, b) => b.updatedAt - a.updatedAt)
              .map((session) => {
                const isActive = session.id === currentSessionId;
                const enemyTeam = session.enemyTeamId ? getTeam(session.enemyTeamId) : null;
                return (
                  <button
                    key={session.id}
                    onClick={() => setCurrentSession(session.id)}
                    className={`
                      text-left p-4 rounded-xl border transition-all duration-200
                      ${isActive
                        ? 'bg-lol-gold/10 border-lol-gold ring-1 ring-lol-gold/50'
                        : 'bg-lol-card border-lol-border hover:bg-lol-card-hover hover:border-lol-border-light'
                      }
                    `}
                  >
                    <div className={`font-semibold truncate ${isActive ? 'text-lol-gold' : 'text-white'}`}>
                      {session.name}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {new Date(session.updatedAt).toLocaleDateString('en-GB')}
                    </div>
                    {enemyTeam && (
                      <div className="text-xs text-red-400 mt-1.5 truncate">
                        vs {enemyTeam.name}
                      </div>
                    )}
                    <div className="flex gap-2 mt-2 text-xs text-gray-500">
                      <span>{session.contestedPicks.length} contested</span>
                      <span>·</span>
                      <span>{session.potentialBans.length} bans</span>
                    </div>
                  </button>
                );
              })}
          </div>
        </div>
      )}

      {/* No session selected */}
      {!currentSession && (
        <Card className="text-center py-12">
          <div className="text-gray-500 mb-2">
            <svg className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-gray-400 mb-6">
            {sessions.length === 0
              ? 'Create your first draft session to start planning'
              : 'Select a draft session or create a new one'}
          </p>
          <Button onClick={() => setIsNewSessionModalOpen(true)} size="lg">
            Create Draft Session
          </Button>
        </Card>
      )}

      {/* Active session */}
      {currentSession && (
        <div className="space-y-8">
          {/* Session header */}
          <Card variant="bordered" padding="lg">
            <div className="flex items-start justify-between gap-6">
              <div className="flex-1 space-y-4">
                <Input
                  label="Session Name"
                  value={currentSession.name}
                  onChange={(e) =>
                    updateSession(currentSession.id, { name: e.target.value })
                  }
                  size="lg"
                />

                {/* Enemy Team Selector - Card Based */}
                <div>
                  <label className="text-sm font-medium text-gray-300 block mb-3">
                    Enemy Team
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => updateSession(currentSession.id, { enemyTeamId: null })}
                      className={`
                        px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                        ${!currentSession.enemyTeamId
                          ? 'bg-lol-surface border-2 border-lol-border-light text-white'
                          : 'bg-lol-dark border border-lol-border text-gray-400 hover:text-white hover:border-lol-border-light'
                        }
                      `}
                    >
                      None
                    </button>
                    {enemyTeams.map((team) => {
                      const isSelected = currentSession.enemyTeamId === team.id;
                      return (
                        <button
                          key={team.id}
                          onClick={() => updateSession(currentSession.id, { enemyTeamId: team.id })}
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
              </div>

              <Button
                variant="danger"
                size="sm"
                onClick={() => handleDeleteSession(currentSession.id)}
              >
                Delete
              </Button>
            </div>
          </Card>

          {/* Enemy team info */}
          {currentEnemyTeam && (
            <Card variant="bordered" padding="lg">
              <h2 className="text-xl font-semibold text-red-400 mb-4">
                Enemy: {currentEnemyTeam.name}
              </h2>
              <OpggLinks team={currentEnemyTeam} />
              {currentEnemyTeam.notes && (
                <p className="mt-4 text-sm text-gray-400 bg-lol-dark rounded-lg p-4 border border-lol-border">
                  {currentEnemyTeam.notes}
                </p>
              )}
            </Card>
          )}

          {/* Statistics */}
          <DraftStatistics myTeam={myTeam} enemyTeam={currentEnemyTeam || null} />

          {/* Draft planning */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ContestedPicks
              picks={currentSession.contestedPicks}
              onAdd={addContestedPick}
              onRemove={removeContestedPick}
            />

            <BanSection
              bans={currentSession.potentialBans}
              onAdd={addPotentialBan}
              onRemove={removePotentialBan}
            />
          </div>

          <PriorityList
            priorities={currentSession.ourPriorities}
            onAdd={addPriority}
            onRemove={removePriority}
          />

          {/* Session notes */}
          <Card variant="bordered" padding="lg">
            <h2 className="text-lg font-semibold text-white mb-4">Draft Notes</h2>
            <textarea
              value={currentSession.notes}
              onChange={(e) =>
                updateSession(currentSession.id, { notes: e.target.value })
              }
              placeholder="Notes for this draft session..."
              className="w-full px-4 py-3 bg-lol-dark border border-lol-border rounded-xl text-white placeholder-gray-500 resize-none focus:outline-none focus:border-lol-gold/50 focus:ring-2 focus:ring-lol-gold/20 transition-all duration-200 min-h-[120px]"
              rows={5}
            />
          </Card>
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

          {/* Enemy Team Selector in Modal - Card Based */}
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
    </div>
  );
}
