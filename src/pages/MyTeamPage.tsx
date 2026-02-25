import { useState, useRef, useEffect } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { useMyTeamStore, MAX_SUBS, getMaxTeams, TeamPermissions } from '../stores/useMyTeamStore';
import { Link } from 'react-router-dom';
import { useRankStore } from '../stores/useRankStore';
import { useMasteryStore } from '../stores/useMasteryStore';
import { useAuthStore, useTierLimits } from '../stores/useAuthStore';
import { parseOpggMultiSearchUrl, Player, Role, ROLES } from '../types';
import { Card, ConfirmationModal, Input, Button, Modal } from '../components/ui';
import { RoleSlot, SubSlot, TeamMembersPanel } from '../components/team';
import { useOpgg } from '../hooks/useOpgg';
import { useDroppable } from '@dnd-kit/core';
import { teamMembershipService } from '../lib/teamMembershipService';

function SubsDropZone({ children }: { children: React.ReactNode }) {
  const { isOver, setNodeRef } = useDroppable({
    id: 'subs-drop-zone',
    data: { type: 'subs' },
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex gap-3 flex-wrap min-h-20 p-2 rounded-xl transition-all duration-200 ${
        isOver ? 'bg-lol-gold/10 ring-2 ring-lol-gold/50' : 'bg-lol-dark/50'
      }`}
    >
      {children}
    </div>
  );
}

export default function MyTeamPage() {
  const {
    teams,
    selectedTeamId,
    memberships,
    membershipsLoading,
    addTeam,
    deleteTeam,
    selectTeam,
    updateTeam,
    updatePlayer,
    importFromOpgg,
    addSub,
    removeSub,
    resetTeam,
    swapPlayerRoles,
    moveToRole,
    moveToSubs,
    addNote,
    updateNote,
    deleteNote,
    loadMemberships,
    getMyPermissions,
  } = useMyTeamStore();

  const team = teams.find((t) => t.id === selectedTeamId) || teams[0];

  const { openMultiSearch } = useOpgg();
  const {
    fetchRanksForContext,
    fetchRanksFromCache,
    isFetchingContext,
    isConfigured: isRankApiConfigured,
    allPlayersUpdated,
    somePlayersNeedUpdate,
  } = useRankStore();

  const { fetchMasteriesFromCache, fetchMasteriesForPlayers } = useMasteryStore();

  const MY_TEAM_CONTEXT = `my-team-${selectedTeamId}`;
  const isLoadingRanks = isFetchingContext(MY_TEAM_CONTEXT);

  // Get players for button state
  const teamPlayers = team?.players
    .filter((p) => p.summonerName && p.tagLine)
    .map((p) => ({ summonerName: p.summonerName, tagLine: p.tagLine, region: p.region })) || [];
  const isUpdated = allPlayersUpdated(teamPlayers);
  const needsUpdate = somePlayersNeedUpdate(teamPlayers);

  // Auto-fetch ranks and masteries from cache on page load
  useEffect(() => {
    if (!isRankApiConfigured() || !team) return;
    const players = team.players
      .filter((p) => p.summonerName && p.tagLine)
      .map((p) => ({ summonerName: p.summonerName, tagLine: p.tagLine, region: p.region }));
    if (players.length > 0) {
      fetchRanksFromCache(players);
      fetchMasteriesFromCache(players);
    }
  }, [team?.id, fetchRanksFromCache, fetchMasteriesFromCache, isRankApiConfigured]);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [importError, setImportError] = useState('');
  const [activePlayer, setActivePlayer] = useState<Player | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editingName, setEditingName] = useState(team?.name || '');
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [teamToDelete, setTeamToDelete] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  const { user } = useAuthStore();
  const { isFreeTier, maxTeams } = useTierLimits();

  // Load memberships when authenticated
  useEffect(() => {
    if (user) {
      loadMemberships();
    }
  }, [user, loadMemberships]);

  // Get permissions for current team
  const permissions: TeamPermissions = team ? getMyPermissions(team.id) : {
    canView: false,
    canEditTeamInfo: false,
    canManageMembers: false,
    canEditAllPlayers: false,
    canEditOwnPlayer: false,
    canEditGroups: false,
    canLeave: false,
    role: 'viewer',
    playerSlotId: null,
  };

  // Check if user is the team owner
  useEffect(() => {
    if (!user || !team) {
      setIsOwner(false);
      return;
    }
    setIsOwner(permissions.role === 'owner');
  }, [user, team?.id, permissions.role]);

  // Sync editingName when team changes
  useEffect(() => {
    setEditingName(team?.name || '');
  }, [team?.id, team?.name]);

  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  const handleNameSave = () => {
    const trimmedName = editingName.trim();
    if (trimmedName) {
      const result = updateTeam({ name: trimmedName });
      if (!result.success && result.error === 'duplicate_name') {
        setNameError('A team with this name already exists');
        return;
      }
      setNameError(null);
    } else {
      setEditingName(team?.name || '');
    }
    setIsEditingName(false);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNameSave();
    } else if (e.key === 'Escape') {
      setEditingName(team?.name || '');
      setIsEditingName(false);
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const handleReset = () => {
    setIsResetModalOpen(true);
  };

  const confirmReset = () => {
    resetTeam();
  };

  const handleRefreshRanks = async () => {
    if (!team || !needsUpdate) return;
    const playersWithNames = team.players.filter(p => p.summonerName && p.tagLine);
    await Promise.all([
      fetchRanksForContext(MY_TEAM_CONTEXT, playersWithNames),
      fetchMasteriesForPlayers(playersWithNames),
    ]);
  };

  const handleDeleteTeam = (teamId: string) => {
    if (teams.length <= 1) return;
    setTeamToDelete(teamId);
  };

  const confirmDeleteTeam = () => {
    if (teamToDelete) {
      deleteTeam(teamToDelete);
      setTeamToDelete(null);
    }
  };

  const handleAddTeam = () => {
    const currentMaxTeams = getMaxTeams();
    if (teams.length >= currentMaxTeams) return;
    // Try adding with incrementing number until we find an available name
    let teamNumber = teams.length + 1;
    let result = addTeam(`Team ${teamNumber}`);
    while (!result.success && result.error === 'duplicate_name' && teamNumber < 100) {
      teamNumber++;
      result = addTeam(`Team ${teamNumber}`);
    }
  };

  const handleImport = () => {
    setImportError('');
    const parsed = parseOpggMultiSearchUrl(importUrl);

    if (!parsed) {
      setImportError('Invalid OP.GG multi-search URL');
      return;
    }

    if (parsed.players.length === 0) {
      setImportError('No players found in URL');
      return;
    }

    importFromOpgg(parsed.region, parsed.players);
    setImportUrl('');
    setIsImportModalOpen(false);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const player = team?.players.find((p) => p.id === active.id);
    setActivePlayer(player || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActivePlayer(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Check if dropping on another player first (for swapping)
    if (activeId !== overId) {
      const draggedPlayer = team?.players.find((p) => p.id === activeId);
      const targetPlayer = team?.players.find((p) => p.id === overId);

      if (draggedPlayer && targetPlayer) {
        swapPlayerRoles(activeId, overId);
        return;
      }
    }

    if (overId.startsWith('role-')) {
      const role = overId.replace('role-', '') as Role;
      moveToRole(activeId, role);
      return;
    }

    if (overId === 'subs-drop-zone') {
      moveToSubs(activeId);
      return;
    }
  };

  const mainRoster = team?.players.filter((p) => !p.isSub) || [];
  const subs = team?.players.filter((p) => p.isSub) || [];

  const getPlayerForRole = (role: Role) => mainRoster.find((p) => p.role === role);

  if (!team) return null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-6">
        {/* Team Tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Owned Teams */}
          {teams.map((t) => (
            <div
              key={t.id}
              className={`group flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-all ${
                t.id === selectedTeamId
                  ? 'bg-lol-gold/20 border border-lol-gold text-lol-gold'
                  : 'bg-lol-card border border-lol-border text-gray-400 hover:border-gray-500 hover:text-gray-300'
              }`}
              onClick={() => selectTeam(t.id)}
            >
              <span className="font-medium truncate max-w-32">{t.name || 'Unnamed'}</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-yellow-500/20 text-yellow-400">
                Owner
              </span>
              {teams.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteTeam(t.id);
                  }}
                  className={`ml-1 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity ${
                    t.id === selectedTeamId
                      ? 'hover:bg-lol-gold/30 text-lol-gold'
                      : 'hover:bg-gray-700 text-gray-500'
                  }`}
                  title="Delete team"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          ))}

          {/* Membership Teams (teams user is a member of) */}
          {memberships.map((m) => (
            <div
              key={m.teamId}
              className={`group flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-all ${
                m.teamId === selectedTeamId
                  ? 'bg-lol-gold/20 border border-lol-gold text-lol-gold'
                  : 'bg-lol-card border border-lol-border text-gray-400 hover:border-gray-500 hover:text-gray-300'
              }`}
              onClick={() => selectTeam(m.teamId)}
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
            </div>
          ))}

          {/* Loading memberships indicator */}
          {membershipsLoading && (
            <div className="px-3 py-2 text-gray-500 text-sm">
              Loading...
            </div>
          )}

          {/* For free tier users with max 1 team, always show upgrade prompt */}
          {isFreeTier && user && maxTeams <= 1 ? (
            <Link
              to="/profile"
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-lol-gold/50 text-lol-gold/80 hover:border-lol-gold hover:text-lol-gold transition-all"
              title="Upgrade to Pro for more teams"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
              <span className="text-sm font-medium">Need more teams? Upgrade to Pro</span>
            </Link>
          ) : teams.length < maxTeams ? (
            <button
              onClick={handleAddTeam}
              className="flex items-center gap-1 px-3 py-2 rounded-lg border border-dashed border-gray-600 text-gray-500 hover:border-lol-gold hover:text-lol-gold transition-all"
              title="Add new team"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span className="text-sm font-medium">New</span>
            </button>
          ) : null}
        </div>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {isEditingName ? (
              <div>
                <input
                  ref={nameInputRef}
                  value={editingName}
                  onChange={(e) => {
                    setEditingName(e.target.value);
                    setNameError(null);
                  }}
                  onBlur={handleNameSave}
                  onKeyDown={handleNameKeyDown}
                  className={`text-3xl font-bold text-white bg-transparent border-b-2 focus:outline-none px-1 ${
                    nameError ? 'border-red-500' : 'border-lol-gold'
                  }`}
                />
                {nameError && (
                  <p className="text-red-500 text-sm mt-1">{nameError}</p>
                )}
              </div>
            ) : (
              <div>
                <h1
                  onClick={() => {
                    setEditingName(team.name);
                    setIsEditingName(true);
                  }}
                  className="text-3xl font-bold text-white cursor-pointer hover:text-lol-gold transition-colors inline-flex items-center gap-2 group"
                  title="Click to edit"
                >
                  {team.name || 'My Team'}
                  <svg
                    className="w-5 h-5 text-gray-500 group-hover:text-lol-gold transition-colors"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </h1>
                <p className="text-gray-400 mt-1">Manage your roster</p>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            {isRankApiConfigured() && teamPlayers.length > 0 && (
              <Button
                variant="ghost"
                onClick={handleRefreshRanks}
                disabled={isLoadingRanks || !needsUpdate}
                title={
                  isUpdated
                    ? 'All players have been updated within the last 24 hours'
                    : 'Fetch player ranks from Riot API'
                }
              >
                {isLoadingRanks ? 'Fetching Ranks...' : isUpdated ? 'Ranks Updated' : 'Update Ranks'}
              </Button>
            )}
            <Button variant="secondary" onClick={() => setIsImportModalOpen(true)}>
              Import from OP.GG
            </Button>
            <Button variant="ghost" onClick={handleReset}>
              Reset
            </Button>
          </div>
        </div>

        {/* Main Roster */}
        <Card variant="bordered" padding="lg">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Main Roster</h2>
            <div className="flex items-center gap-4">
              <p className="text-xs text-gray-500">Drag players to assign roles</p>
              {mainRoster.filter((p) => p.summonerName).length > 0 && (
                <button
                  onClick={() => openMultiSearch(mainRoster, mainRoster[0]?.region || 'euw')}
                  className="text-xs text-lol-gold hover:text-lol-gold-light transition-colors font-medium"
                >
                  OP.GG Multi-Search
                </button>
              )}
            </div>
          </div>
          <SortableContext
            items={mainRoster.map((p) => p.id)}
            strategy={horizontalListSortingStrategy}
          >
            <div className="flex gap-3 p-2 rounded-xl bg-lol-dark/50">
              {ROLES.map((role) => (
                <RoleSlot
                  key={role.value}
                  role={role.value as Role}
                  player={getPlayerForRole(role.value as Role)}
                  onPlayerChange={updatePlayer}
                />
              ))}
            </div>
          </SortableContext>
        </Card>

        {/* Subs */}
        <Card variant="bordered" padding="lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Substitutes ({subs.length}/{MAX_SUBS})</h2>
            <Button variant="ghost" size="sm" onClick={addSub} disabled={subs.length >= MAX_SUBS}>
              + Add Sub
            </Button>
          </div>
          <SortableContext items={subs.map((p) => p.id)}>
            <SubsDropZone>
              {subs.length === 0 ? (
                <p className="text-sm text-gray-500 p-4 w-full text-center">
                  No subs - drag a player here or click Add Sub
                </p>
              ) : (
                subs.map((sub) => (
                  <SubSlot
                    key={sub.id}
                    player={sub}
                    onPlayerChange={updatePlayer}
                    onRemove={() => removeSub(sub.id)}
                  />
                ))
              )}
            </SubsDropZone>
          </SortableContext>
        </Card>

        {/* Notepad */}
        <Card variant="bordered" padding="lg">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">Team Notes</h2>
          <div className="flex flex-wrap gap-3">
            {(team.notepad || []).map((note) => (
              <div
                key={note.id}
                className="relative group w-[calc((100%-3rem)/5)] min-w-36 h-38 bg-lol-dark rounded-xl border border-lol-border/50 p-3 hover:border-lol-border-light transition-all duration-200"
              >
                <button
                  onClick={() => deleteNote(note.id)}
                  className="absolute -top-2 -right-2 w-5 h-5 bg-red-500/80 hover:bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center z-10"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <textarea
                  value={note.content}
                  onChange={(e) => updateNote(note.id, e.target.value)}
                  placeholder="Add note..."
                  className="w-full h-full bg-transparent text-white text-sm placeholder-gray-600 resize-none focus:outline-none"
                />
              </div>
            ))}
            {/* Add Note Placeholder */}
            <button
              onClick={() => addNote()}
              className="w-[calc((100%-3rem)/5)] min-w-36 h-38 bg-lol-card/50 rounded-xl border border-dashed border-lol-border/50 hover:border-lol-gold/50 hover:bg-lol-card transition-all duration-200 flex flex-col items-center justify-center gap-2 text-gray-500 hover:text-lol-gold"
            >
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
              </svg>
              <span className="text-sm">Add Note</span>
            </button>
          </div>
        </Card>

        {/* Team Members - only show when authenticated */}
        {user && (
          <Card variant="bordered" padding="lg">
            <TeamMembersPanel
              teamId={team.id}
              teamName={team.name}
              players={team.players}
              isOwner={isOwner}
            />
          </Card>
        )}

        {/* Import Modal */}
        <Modal
          isOpen={isImportModalOpen}
          onClose={() => {
            setIsImportModalOpen(false);
            setImportError('');
            setImportUrl('');
          }}
          title="Import from OP.GG"
        >
          <div className="space-y-5">
            <p className="text-sm text-gray-400 bg-lol-dark rounded-lg p-4 border border-lol-border">
              Paste an OP.GG multi-search URL to import your team.
            </p>
            <Input
              label="OP.GG URL"
              value={importUrl}
              onChange={(e) => {
                setImportUrl(e.target.value);
                setImportError('');
              }}
              placeholder="https://www.op.gg/multisearch/euw?summoners=..."
              autoFocus
            />
            {importError && (
              <p className="text-sm text-red-400 bg-red-500/10 rounded-lg p-3 border border-red-500/20">{importError}</p>
            )}
            <div className="flex gap-3 justify-end pt-2">
              <Button variant="ghost" onClick={() => setIsImportModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleImport} disabled={!importUrl.trim()}>
                Import
              </Button>
            </div>
          </div>
        </Modal>

        {/* Reset confirmation modal */}
        <ConfirmationModal
          isOpen={isResetModalOpen}
          onClose={() => setIsResetModalOpen(false)}
          onConfirm={confirmReset}
          title="Reset Team"
          message="Are you sure you want to reset this team? This will clear all player data."
          confirmText="Reset"
          variant="warning"
        />

        {/* Delete confirmation modal */}
        <ConfirmationModal
          isOpen={!!teamToDelete}
          onClose={() => setTeamToDelete(null)}
          onConfirm={confirmDeleteTeam}
          title="Delete Team"
          message="Are you sure you want to delete this team?"
          confirmText="Delete"
        />

        {/* Drag Overlay */}
        <DragOverlay>
          {activePlayer ? (
            <div className="bg-lol-card border border-lol-gold rounded-xl px-4 py-3 shadow-xl shadow-lol-gold/20">
              <div className="font-semibold text-lol-gold text-sm">
                {ROLES.find((r) => r.value === activePlayer.role)?.label}
              </div>
              <div className="text-white font-medium mt-1">{activePlayer.summonerName || 'Empty'}</div>
              <div className="text-gray-400 text-xs mt-0.5">#{activePlayer.tagLine}</div>
            </div>
          ) : null}
        </DragOverlay>
      </div>
    </DndContext>
  );
}
