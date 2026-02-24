import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useDraftStore } from '../stores/useDraftStore';
import { useEnemyTeamStore } from '../stores/useEnemyTeamStore';
import { useMyTeamStore } from '../stores/useMyTeamStore';
import { useAuthStore } from '../stores/useAuthStore';
import { Button, Card, ConfirmationModal, Input, Modal } from '../components/ui';
import { DraftPlanningHub, TeamVsDisplay } from '../components/draft';
import ShareModal from '../components/share/ShareModal';
import LoginModal from '../components/auth/LoginModal';

function SettingsDropdown({ onDelete }: { onDelete: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-4.5 flex items-center justify-center rounded-xl bg-lol-dark border border-lol-border text-gray-400 hover:text-white hover:border-lol-border-light transition-all"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-40 bg-lol-card border border-lol-border rounded-xl shadow-xl z-20 overflow-hidden">
          <button
            onClick={() => {
              setIsOpen(false);
              onDelete();
            }}
            className="w-full px-4 py-2.5 text-left text-sm text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete draft
          </button>
        </div>
      )}
    </div>
  );
}

export default function DraftDetailPage() {
  const { draftId } = useParams<{ draftId: string }>();
  const navigate = useNavigate();

  const {
    sessions,
    setCurrentSession,
    updateSession,
    deleteSession,
    addPotentialBan,
    removePotentialBan,
    addPriority,
    removePriority,
    createSession,
    addNote,
    updateNote,
    deleteNote,
    // Ban group actions
    addBanGroup,
    renameBanGroup,
    deleteBanGroup,
    reorderBanGroups,
    addChampionToBanGroup,
    removeChampionFromBanGroup,
    reorderChampionsInBanGroup,
    moveChampionBetweenBanGroups,
    // Priority group actions
    addPriorityGroup,
    renamePriorityGroup,
    deletePriorityGroup,
    reorderPriorityGroups,
    addChampionToPriorityGroup,
    removeChampionFromPriorityGroup,
    reorderChampionsInPriorityGroup,
    moveChampionBetweenPriorityGroups,
  } = useDraftStore();

  const { teams: enemyTeams, getTeam } = useEnemyTeamStore();
  const { teams: myTeams, selectedTeamId } = useMyTeamStore();
  const myTeam = myTeams.find((t) => t.id === selectedTeamId) || myTeams[0];

  const [isNewSessionModalOpen, setIsNewSessionModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');

  const isAuthenticated = useAuthStore((state) => !!state.user);
  const [selectedEnemyTeamId, setSelectedEnemyTeamId] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);

  // Find the current session
  const currentSession = sessions.find((s) => s.id === draftId);
  const currentEnemyTeam = currentSession?.enemyTeamId
    ? getTeam(currentSession.enemyTeamId)
    : null;

  // Set current session when component mounts or draftId changes
  useEffect(() => {
    if (draftId) {
      setCurrentSession(draftId);
    }
  }, [draftId, setCurrentSession]);

  // Ensure session has myTeamId set (for shared drafts to work properly)
  useEffect(() => {
    if (currentSession && myTeam && !currentSession.myTeamId) {
      updateSession(currentSession.id, { myTeamId: myTeam.id });
    }
  }, [currentSession, myTeam, updateSession]);

  // Redirect to list if session not found
  useEffect(() => {
    if (draftId && sessions.length > 0 && !currentSession) {
      navigate('/draft');
    }
  }, [draftId, sessions, currentSession, navigate]);

  const handleCreateSession = () => {
    if (newSessionName.trim()) {
      const session = createSession(
        newSessionName.trim(),
        selectedEnemyTeamId || undefined,
        myTeam?.id // Pass my team ID for shared drafts
      );
      setNewSessionName('');
      setSelectedEnemyTeamId('');
      setIsNewSessionModalOpen(false);
      navigate(`/draft/${session.id}`);
    }
  };

  const handleDeleteSession = () => {
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteSession = () => {
    if (currentSession) {
      deleteSession(currentSession.id);
      navigate('/draft');
    }
  };

  if (!currentSession) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Header */}
      <div className="space-y-4">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm">
          <Link
            to="/draft"
            className="text-gray-400 hover:text-white transition-colors flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            All Drafts
          </Link>
          <span className="text-gray-600">/</span>
          <span className="text-gray-300 truncate max-w-xs">{currentSession.name}</span>
        </div>

        {/* Title & Actions */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {isEditingName ? (
              <input
                type="text"
                value={currentSession.name}
                onChange={(e) => updateSession(currentSession.id, { name: e.target.value })}
                onBlur={() => setIsEditingName(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setIsEditingName(false);
                  if (e.key === 'Escape') setIsEditingName(false);
                }}
                autoFocus
                className="text-3xl font-bold text-white bg-transparent border-b-2 border-lol-gold/50 focus:border-lol-gold outline-none w-full pb-1"
              />
            ) : (
              <h1
                onClick={() => setIsEditingName(true)}
                className="text-3xl font-bold text-white cursor-pointer hover:text-lol-gold transition-colors truncate"
                title="Click to edit"
              >
                {currentSession.name}
              </h1>
            )}
            {currentEnemyTeam && (
              <p className="text-red-400 mt-1">vs {currentEnemyTeam.name}</p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isAuthenticated ? (
              <button
                onClick={() => setIsShareModalOpen(true)}
                className="group flex items-center gap-3 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500/10 to-blue-500/5 border border-blue-500/30 hover:border-blue-500/60 hover:from-blue-500/20 hover:to-blue-500/10 transition-all"
              >
                <div className="p-1.5 rounded-lg bg-blue-500/20 group-hover:bg-blue-500/30 transition-colors">
                  <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                </div>
                <div className="text-left">
                  <div className="text-xs text-gray-400">Share with your team</div>
                  <div className="text-sm text-blue-400 font-medium group-hover:text-blue-300 transition-colors">Get shareable link</div>
                </div>
              </button>
            ) : (
              <button
                onClick={() => setIsLoginModalOpen(true)}
                className="group flex items-center gap-3 px-4 py-2.5 rounded-xl bg-gradient-to-r from-lol-gold/10 to-lol-gold/5 border border-lol-gold/30 hover:border-lol-gold/60 hover:from-lol-gold/20 hover:to-lol-gold/10 transition-all"
              >
                <div className="p-1.5 rounded-lg bg-lol-gold/20 group-hover:bg-lol-gold/30 transition-colors">
                  <svg className="w-4 h-4 text-lol-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                </div>
                <div className="text-left">
                  <div className="text-xs text-gray-400">Want to share this draft?</div>
                  <div className="text-sm text-lol-gold font-medium group-hover:text-lol-gold-light transition-colors">Log in to share</div>
                </div>
              </button>
            )}
            <SettingsDropdown onDelete={handleDeleteSession} />
          </div>
        </div>
      </div>

      {/* Team VS Display */}
      <TeamVsDisplay
        myTeam={myTeam}
        enemyTeam={currentEnemyTeam || null}
        selectedEnemyTeamId={currentSession.enemyTeamId}
        onSelectEnemyTeam={(teamId) =>
          updateSession(currentSession.id, { enemyTeamId: teamId })
        }
      />

      {/* Enemy notes if present */}
      {currentEnemyTeam?.notes && (
        <div className="text-sm text-gray-400 bg-lol-dark/50 rounded-lg px-4 py-3 border-l-2 border-red-500/50">
          <span className="text-red-400 font-medium">Notes:</span> {currentEnemyTeam.notes}
        </div>
      )}

      {/* Draft Planning Hub - Main Interface */}
      <DraftPlanningHub
        myTeam={myTeam}
        enemyTeam={currentEnemyTeam || null}
        session={currentSession}
        // Legacy actions (for panels)
        onAddBan={addPotentialBan}
        onRemoveBan={removePotentialBan}
        onAddPriority={addPriority}
        onRemovePriority={removePriority}
        // Ban group actions
        onAddBanGroup={addBanGroup}
        onRenameBanGroup={renameBanGroup}
        onDeleteBanGroup={deleteBanGroup}
        onReorderBanGroups={reorderBanGroups}
        onAddChampionToBanGroup={addChampionToBanGroup}
        onRemoveChampionFromBanGroup={removeChampionFromBanGroup}
        onReorderChampionsInBanGroup={reorderChampionsInBanGroup}
        onMoveChampionBetweenBanGroups={moveChampionBetweenBanGroups}
        // Priority group actions
        onAddPriorityGroup={addPriorityGroup}
        onRenamePriorityGroup={renamePriorityGroup}
        onDeletePriorityGroup={deletePriorityGroup}
        onReorderPriorityGroups={reorderPriorityGroups}
        onAddChampionToPriorityGroup={addChampionToPriorityGroup}
        onRemoveChampionFromPriorityGroup={removeChampionFromPriorityGroup}
        onReorderChampionsInPriorityGroup={reorderChampionsInPriorityGroup}
        onMoveChampionBetweenPriorityGroups={moveChampionBetweenPriorityGroups}
      />

      {/* Session notes */}
      <Card variant="bordered" padding="lg">
        <h2 className="text-lg font-semibold text-white mb-4">Draft Notes</h2>
        <div className="flex flex-wrap gap-3">
          {(currentSession.notepad || []).map((note) => (
            <div
              key={note.id}
              className="relative group w-[calc((100%-3rem)/5)] min-w-36 h-38 bg-lol-dark rounded-xl border border-lol-border/50 p-3 hover:border-lol-border-light transition-all duration-200"
            >
              <button
                onClick={() => deleteNote(currentSession.id, note.id)}
                className="absolute -top-2 -right-2 w-5 h-5 bg-red-500/80 hover:bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center z-10"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <textarea
                value={note.content}
                onChange={(e) => updateNote(currentSession.id, note.id, e.target.value)}
                placeholder="Add note..."
                className="w-full h-full bg-transparent text-white text-sm placeholder-gray-600 resize-none focus:outline-none"
              />
            </div>
          ))}
          {/* Add Note Placeholder */}
          <button
            onClick={() => addNote(currentSession.id)}
            className="w-[calc((100%-3rem)/5)] min-w-36 h-38 bg-lol-card/50 rounded-xl border border-dashed border-lol-border/50 hover:border-lol-gold/50 hover:bg-lol-card transition-all duration-200 flex flex-col items-center justify-center gap-2 text-gray-500 hover:text-lol-gold"
          >
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-sm">Add Note</span>
          </button>
        </div>
      </Card>

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

      {/* Share modal */}
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        draftSessionId={currentSession.id}
        draftName={currentSession.name}
      />

      {/* Login modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
      />

      {/* Delete confirmation modal */}
      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDeleteSession}
        title="Delete Draft"
        message="Are you sure you want to delete this draft session?"
        confirmText="Delete"
      />
    </div>
  );
}
