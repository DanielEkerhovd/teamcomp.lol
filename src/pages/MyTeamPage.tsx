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
import { Link, useSearchParams } from 'react-router-dom';
import { useRankStore } from '../stores/useRankStore';
import { useMasteryStore } from '../stores/useMasteryStore';
import { useAuthStore, useTierLimits } from '../stores/useAuthStore';
import { parseOpggMultiSearchUrl, Player, Role, ROLES } from '../types';
import { Card, ConfirmationModal, Input, Button, Modal } from '../components/ui';
import { RoleSlot, SubSlot, TeamMembersPanel } from '../components/team';
import { useOpgg } from '../hooks/useOpgg';
import { useDroppable } from '@dnd-kit/core';
import { teamMembershipService } from '../lib/teamMembershipService';
import { notificationService } from '../lib/notificationService';
import { syncManager } from '../lib/syncManager';
import { checkModerationAndRecord, getViolationWarning } from '../lib/moderation';

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
    membershipTeamData,
    membershipTeamLoading,
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
    isTeamNameAvailable,
    checkTeamNameGloballyAvailable,
  } = useMyTeamStore();

  // Check if a membership team is selected
  const isMembershipTeam = memberships.some((m) => m.teamId === selectedTeamId);
  const ownedTeam = teams.find((t) => t.id === selectedTeamId) || teams[0];
  const team = isMembershipTeam ? (membershipTeamData || ownedTeam) : ownedTeam;

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
  const [importSuccess, setImportSuccess] = useState('');
  const [activePlayer, setActivePlayer] = useState<Player | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [createTeamError, setCreateTeamError] = useState<string | null>(null);
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [isRenamingTeam, setIsRenamingTeam] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  const { user } = useAuthStore();
  const { isFreeTier, maxTeams } = useTierLimits();
  const [searchParams, setSearchParams] = useSearchParams();

  // Load memberships when authenticated
  useEffect(() => {
    if (user) {
      loadMemberships();
    }
  }, [user, loadMemberships]);

  // Deep-link: select team from ?team=<teamId> URL param
  // Wait until memberships have loaded so selectTeam can find membership teams
  useEffect(() => {
    if (membershipsLoading) return;
    const teamParam = searchParams.get('team');
    if (teamParam && teamParam !== selectedTeamId) {
      selectTeam(teamParam);
      // Clean up the URL param after selecting
      searchParams.delete('team');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, selectedTeamId, selectTeam, setSearchParams, membershipsLoading]);

  // Auto-select first available team if current selection is invalid
  // (e.g. user only has membership teams, or selectedTeamId is stale)
  useEffect(() => {
    if (membershipsLoading) return;
    // Skip if a deep-link param is pending (will be handled by the effect above)
    if (searchParams.get('team')) return;
    const hasValidSelection =
      teams.some((t) => t.id === selectedTeamId) ||
      memberships.some((m) => m.teamId === selectedTeamId);
    if (!hasValidSelection) {
      if (teams.length > 0) {
        selectTeam(teams[0].id);
      } else if (memberships.length > 0) {
        selectTeam(memberships[0].teamId);
      }
    }
  }, [teams, memberships, selectedTeamId, selectTeam, membershipsLoading, searchParams]);

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

  // Close settings menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setIsSettingsOpen(false);
      }
    };
    if (isSettingsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isSettingsOpen]);

  const handleOpenRenameModal = () => {
    setRenameValue(team?.name || '');
    setRenameError(null);
    setIsRenameModalOpen(true);
  };

  const handleRenameChange = (name: string) => {
    setRenameValue(name);
    if (renameError) {
      setRenameError(null);
    }
  };

  const confirmRenameTeam = async () => {
    const trimmedName = renameValue.trim();

    if (!trimmedName) {
      setRenameError('Please enter a team name');
      return;
    }

    // If name is exactly the same, just close
    if (trimmedName === team?.name) {
      setIsRenameModalOpen(false);
      return;
    }

    // Moderate team name content
    const modResult = await checkModerationAndRecord(trimmedName, 'team_name');
    if (modResult.flagged) {
      setRenameError(getViolationWarning(modResult));
      if (modResult.autoBanned) useAuthStore.getState().refreshProfile();
      return;
    }

    // Check if it's just a casing change (user owns this name, so allow it)
    const isOnlyCasingChange = trimmedName.toLowerCase() === team?.name.toLowerCase();

    // Only check for duplicates if it's not just a casing change
    if (!isOnlyCasingChange) {
      // Quick local check first
      if (!isTeamNameAvailable(trimmedName, team?.id)) {
        setRenameError('A team with this name already exists');
        return;
      }

      // Check global availability in database
      setIsRenamingTeam(true);
      setRenameError(null);

      try {
        const availabilityResult = await checkTeamNameGloballyAvailable(trimmedName, team?.id);
        if (!availabilityResult.available) {
          setRenameError(availabilityResult.error || 'A team with this name already exists');
          setIsRenamingTeam(false);
          return;
        }
      } catch (error) {
        console.error('Error checking team name:', error);
        setRenameError("Couldn't rename team. Please try again.");
        setIsRenamingTeam(false);
        return;
      }
    } else {
      setIsRenamingTeam(true);
    }

    try {
      const result = updateTeam({ name: trimmedName });
      if (!result.success && result.error === 'duplicate_name') {
        setRenameError('A team with this name already exists');
        setIsRenamingTeam(false);
        return;
      }

      // Force immediate sync to cloud
      await syncManager.flushPendingSyncs();

      setIsRenameModalOpen(false);
      setRenameValue('');
      setRenameError(null);
    } catch (error) {
      console.error('Error renaming team:', error);
      setRenameError("Couldn't rename team. Please try again.");
    } finally {
      setIsRenamingTeam(false);
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const handleReset = () => {
    setIsSettingsOpen(false);
    setIsResetModalOpen(true);
  };

  const confirmReset = () => {
    resetTeam();
    setIsResetModalOpen(false);
  };

  const handleDeleteTeamClick = () => {
    setIsSettingsOpen(false);
    setDeleteError(null);
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteTeam = async () => {
    if (!team) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      // Get team name before deletion for notification
      const teamName = team.name;

      // Remove all members and get their user IDs
      const memberUserIds = await teamMembershipService.removeAllTeamMembers(team.id);

      // Send notifications to all removed members
      if (memberUserIds.length > 0) {
        await notificationService.sendNotificationToMany(
          memberUserIds,
          'team_deleted',
          'Team Deleted',
          `The team "${teamName}" has been deleted by its owner.`,
          { teamId: team.id, teamName }
        );
      }

      // Delete the team
      deleteTeam(team.id);

      // Force immediate sync to cloud (don't wait for debounce)
      await syncManager.flushPendingSyncs();

      setIsDeleteModalOpen(false);
    } catch (error) {
      console.error('Error deleting team:', error);
      setDeleteError("Couldn't delete team. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleLeaveTeamClick = () => {
    setIsSettingsOpen(false);
    setLeaveError(null);
    setIsLeaveModalOpen(true);
  };

  const confirmLeaveTeam = async () => {
    if (!team) return;
    setIsLeaving(true);
    setLeaveError(null);
    try {
      const result = await teamMembershipService.leaveTeam(team.id);
      if (!result.success) {
        setLeaveError(result.error || "Couldn't leave team. Please try again.");
        return;
      }
      setIsLeaveModalOpen(false);
      await loadMemberships();
      // Select the first owned team after leaving
      if (teams.length > 0) {
        selectTeam(teams[0].id);
      }
    } catch (error) {
      console.error('Error leaving team:', error);
      setLeaveError("Couldn't leave team. Please try again.");
    } finally {
      setIsLeaving(false);
    }
  };

  const handleRefreshRanks = async () => {
    if (!team || !needsUpdate) return;
    const playersWithNames = team.players.filter(p => p.summonerName && p.tagLine);
    await Promise.all([
      fetchRanksForContext(MY_TEAM_CONTEXT, playersWithNames),
      fetchMasteriesForPlayers(playersWithNames),
    ]);
  };

  const handleAddTeam = () => {
    const currentMaxTeams = getMaxTeams();
    if (teams.length >= currentMaxTeams) return;
    setNewTeamName('');
    setCreateTeamError(null);
    setIsCreateModalOpen(true);
  };

  const handleCreateTeamNameChange = (name: string) => {
    setNewTeamName(name);
    // Clear error when user types
    if (createTeamError) {
      setCreateTeamError(null);
    }
  };

  const confirmCreateTeam = async () => {
    const trimmedName = newTeamName.trim();

    if (!trimmedName) {
      setCreateTeamError('Please enter a team name');
      return;
    }

    // Moderate team name content
    const modResult = await checkModerationAndRecord(trimmedName, 'team_name');
    if (modResult.flagged) {
      setCreateTeamError(getViolationWarning(modResult));
      if (modResult.autoBanned) useAuthStore.getState().refreshProfile();
      return;
    }

    // Quick local check first
    if (!isTeamNameAvailable(trimmedName)) {
      setCreateTeamError('A team with this name already exists');
      return;
    }

    // Check global availability in database
    setIsCreatingTeam(true);
    setCreateTeamError(null);

    try {
      const availabilityResult = await checkTeamNameGloballyAvailable(trimmedName);
      if (!availabilityResult.available) {
        setCreateTeamError(availabilityResult.error || 'A team with this name already exists');
        setIsCreatingTeam(false);
        return;
      }

      const result = addTeam(trimmedName);
      if (!result.success) {
        if (result.error === 'duplicate_name') {
          setCreateTeamError('A team with this name already exists');
        } else if (result.error === 'max_teams_reached') {
          setCreateTeamError('You have reached the maximum number of teams');
        }
        setIsCreatingTeam(false);
        return;
      }

      setIsCreateModalOpen(false);
      setNewTeamName('');
      setCreateTeamError(null);
    } catch (error) {
      console.error('Error checking team name:', error);
      setCreateTeamError("Couldn't create team. Please try again.");
    } finally {
      setIsCreatingTeam(false);
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

    const result = importFromOpgg(parsed.region, parsed.players);
    setImportUrl('');

    const messages: string[] = [];
    if (result.added > 0) messages.push(`Added ${result.added} player${result.added !== 1 ? 's' : ''}`);
    if (result.duplicates > 0) messages.push(`${result.duplicates} already on roster`);
    if (result.overflow > 0) messages.push(`${result.overflow} couldn't be added — roster full (5 players + 5 subs max)`);

    if (result.overflow > 0 || result.duplicates > 0) {
      setImportSuccess(result.added > 0 ? messages.join('. ') + '.' : '');
      setImportError(result.added === 0 ? messages.join('. ') + '.' : (result.overflow > 0 ? `${result.overflow} player${result.overflow !== 1 ? 's' : ''} couldn't be added — roster full.` : ''));
    } else {
      setImportSuccess(messages.join('. ') + '.');
      setImportError('');
      setIsImportModalOpen(false);
    }
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

  // Show loading spinner while memberships are loading and we have no team yet
  if (!team && membershipsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-lol-gold" />
      </div>
    );
  }

  // Empty state when no teams exist (owned or membership)
  if (!team) {
    return (
      <>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <div className="w-20 h-20 mb-6 rounded-full bg-lol-card border border-lol-border flex items-center justify-center">
            <svg className="w-10 h-10 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">No Teams Yet</h2>
          <p className="text-gray-400 mb-6 max-w-md">
            Create your first team to start managing your roster and planning drafts.
          </p>
          <Button onClick={handleAddTeam}>
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Team
          </Button>
        </div>

        {/* Create team modal */}
        <Modal
          isOpen={isCreateModalOpen}
          onClose={() => {
            if (!isCreatingTeam) {
              setIsCreateModalOpen(false);
              setNewTeamName('');
              setCreateTeamError(null);
            }
          }}
          title="Create New Team"
        >
          <div className="space-y-4">
            <div>
              <Input
                label="Team Name"
                value={newTeamName}
                onChange={(e) => handleCreateTeamNameChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isCreatingTeam) {
                    confirmCreateTeam();
                  }
                }}
                placeholder="Enter team name"
                autoFocus
                disabled={isCreatingTeam}
              />
              {createTeamError && (
                <p className="text-red-500 text-sm mt-2">{createTeamError}</p>
              )}
            </div>
            <div className="flex gap-3 justify-end">
              <Button
                variant="ghost"
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setNewTeamName('');
                  setCreateTeamError(null);
                }}
                disabled={isCreatingTeam}
              >
                Cancel
              </Button>
              <Button onClick={confirmCreateTeam} disabled={!newTeamName.trim() || isCreatingTeam}>
                {isCreatingTeam ? 'Creating...' : 'Create Team'}
              </Button>
            </div>
          </div>
        </Modal>
      </>
    );
  }

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
              to="/profile#plan"
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-lol-gold/50 text-lol-gold/80 hover:border-lol-gold hover:text-lol-gold transition-all"
              title="Upgrade to Pro for more teams"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
              <span className="text-sm font-medium">Are you managing more teams? Pro is made for coaches!</span>
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

        {/* Loading state for membership teams */}
        {isMembershipTeam && membershipTeamLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-lol-gold" />
          </div>
        )}

        {/* Header */}
        {!(isMembershipTeam && membershipTeamLoading) && (<>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white">
                {team.name || 'My Team'}
              </h1>
              <p className="text-gray-400 mt-1">
                {isMembershipTeam
                  ? `Member \u00B7 ${memberships.find(m => m.teamId === selectedTeamId)?.role || 'viewer'} \u00B7 Owned by ${memberships.find(m => m.teamId === selectedTeamId)?.ownerName || 'unknown'}`
                  : 'Manage your roster'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {user && isOwner && (
              <Button variant="secondary" onClick={() => setIsInviteModalOpen(true)}>
                <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                Invite Members
              </Button>
            )}
            <Button variant="secondary" onClick={() => setIsImportModalOpen(true)}>
              Import from OP.GG
            </Button>
            {/* Settings Dropdown */}
            <div className="relative" ref={settingsRef}>
              <Button
                variant="ghost"
                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                className="px-2!"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </Button>
              {isSettingsOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-lol-card border border-lol-border rounded-lg shadow-xl z-50 overflow-hidden">
                  <button
                    onClick={() => {
                      setIsSettingsOpen(false);
                      handleOpenRenameModal();
                    }}
                    className="w-full px-4 py-3 text-left text-sm text-gray-300 hover:bg-lol-gold/10 hover:text-lol-gold flex items-center gap-3 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    Rename Team
                  </button>
                  <button
                    onClick={handleReset}
                    className="w-full px-4 py-3 text-left text-sm text-yellow-400 hover:bg-yellow-500/10 flex items-center gap-3 transition-colors border-t border-lol-border"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Reset Team
                  </button>
                  {isOwner ? (
                    <button
                      onClick={handleDeleteTeamClick}
                      className="w-full px-4 py-3 text-left text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-3 transition-colors border-t border-lol-border"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete Team
                    </button>
                  ) : (
                    <button
                      onClick={handleLeaveTeamClick}
                      className="w-full px-4 py-3 text-left text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-3 transition-colors border-t border-lol-border"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Leave Team
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Roster */}
        <Card variant="bordered" padding="lg">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Main Roster</h2>
            <div className="flex items-center gap-4">
              {isRankApiConfigured() && teamPlayers.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
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
              {mainRoster.filter((p) => p.summonerName).length > 0 && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => openMultiSearch(mainRoster, mainRoster[0]?.region || 'euw')}
                >
                  OP.GG Multi-Search
                </Button>
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
          <div className="flex items-center gap-4 mt-3">
            <p className="text-xs text-gray-500">Drag players to assign roles</p>
          </div>
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
              currentUserId={user?.id}
              currentUserRole={permissions.role}
              isInviteModalOpen={isInviteModalOpen}
              onInviteModalClose={() => setIsInviteModalOpen(false)}
              onLeaveTeam={() => handleLeaveTeamClick()}
            />
          </Card>
        )}
        </>)}

        {/* Import Modal */}
        <Modal
          isOpen={isImportModalOpen}
          onClose={() => {
            setIsImportModalOpen(false);
            setImportError('');
            setImportSuccess('');
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
                setImportSuccess('');
              }}
              placeholder="https://www.op.gg/multisearch/euw?summoners=..."
              autoFocus
            />
            {importSuccess && (
              <p className="text-sm text-green-400 bg-green-500/10 rounded-lg p-3 border border-green-500/20">{importSuccess}</p>
            )}
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

        {/* Delete team confirmation modal */}
        <ConfirmationModal
          isOpen={isDeleteModalOpen}
          onClose={() => {
            if (!isDeleting) {
              setIsDeleteModalOpen(false);
              setDeleteError(null);
            }
          }}
          onConfirm={confirmDeleteTeam}
          title="Delete Team"
          message={`Are you sure you want to delete "${team?.name}"? This action cannot be undone. All team members will be removed and notified.`}
          confirmText="Delete Team"
          variant="danger"
          isLoading={isDeleting}
          error={deleteError}
        />

        {/* Leave team confirmation modal */}
        <ConfirmationModal
          isOpen={isLeaveModalOpen}
          onClose={() => {
            if (!isLeaving) {
              setIsLeaveModalOpen(false);
              setLeaveError(null);
            }
          }}
          onConfirm={confirmLeaveTeam}
          title="Leave Team"
          message={`Are you sure you want to leave "${team?.name}"? You will lose access to this team unless re-invited.`}
          confirmText="Leave Team"
          variant="danger"
          isLoading={isLeaving}
          error={leaveError}
        />

        {/* Create team modal */}
        <Modal
          isOpen={isCreateModalOpen}
          onClose={() => {
            if (!isCreatingTeam) {
              setIsCreateModalOpen(false);
              setNewTeamName('');
              setCreateTeamError(null);
            }
          }}
          title="Create New Team"
        >
          <div className="space-y-4">
            <div>
              <Input
                label="Team Name"
                value={newTeamName}
                onChange={(e) => handleCreateTeamNameChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isCreatingTeam) {
                    confirmCreateTeam();
                  }
                }}
                placeholder="Enter team name"
                autoFocus
                disabled={isCreatingTeam}
              />
              {createTeamError && (
                <p className="text-red-500 text-sm mt-2">{createTeamError}</p>
              )}
            </div>
            <div className="flex gap-3 justify-end">
              <Button
                variant="ghost"
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setNewTeamName('');
                  setCreateTeamError(null);
                }}
                disabled={isCreatingTeam}
              >
                Cancel
              </Button>
              <Button onClick={confirmCreateTeam} disabled={!newTeamName.trim() || isCreatingTeam}>
                {isCreatingTeam ? 'Creating...' : 'Create Team'}
              </Button>
            </div>
          </div>
        </Modal>

        {/* Rename team modal */}
        <Modal
          isOpen={isRenameModalOpen}
          onClose={() => {
            if (!isRenamingTeam) {
              setIsRenameModalOpen(false);
              setRenameValue('');
              setRenameError(null);
            }
          }}
          title="Rename Team"
        >
          <div className="space-y-4">
            <div>
              <Input
                label="Team Name"
                value={renameValue}
                onChange={(e) => handleRenameChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isRenamingTeam) {
                    confirmRenameTeam();
                  }
                }}
                placeholder="Enter team name"
                autoFocus
                disabled={isRenamingTeam}
              />
              {renameError && (
                <p className="text-red-500 text-sm mt-2">{renameError}</p>
              )}
            </div>
            <div className="flex gap-3 justify-end">
              <Button
                variant="ghost"
                onClick={() => {
                  setIsRenameModalOpen(false);
                  setRenameValue('');
                  setRenameError(null);
                }}
                disabled={isRenamingTeam}
              >
                Cancel
              </Button>
              <Button onClick={confirmRenameTeam} disabled={!renameValue.trim() || isRenamingTeam}>
                {isRenamingTeam ? 'Renaming...' : 'Rename'}
              </Button>
            </div>
          </div>
        </Modal>

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
