import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { liveDraftService } from '../lib/liveDraftService';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/useAuthStore';
import { Button, Card } from '../components/ui';
import JoinTeamModal from '../components/live-draft/JoinTeamModal';
import type {
  LiveDraftSession,
  LiveDraftParticipant,
  DraftMode,
  DraftSide,
} from '../types/liveDraft';

const DRAFT_MODE_LABELS: Record<DraftMode, string> = {
  normal: 'Normal',
  fearless: 'Fearless',
  ironman: 'Ironman',
};

const DRAFT_MODE_DESCRIPTIONS: Record<DraftMode, string> = {
  normal: 'Standard draft rules',
  fearless: "Champions can't be picked by the same team twice",
  ironman: 'Picked/banned champions are unavailable for the series',
};

export default function LiveDraftLobbyPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const authUser = useAuthStore((s) => s.user);
  const authProfile = useAuthStore((s) => s.profile);

  // Debug: Log on every render
  console.log('LiveDraftLobbyPage render:', { sessionId });

  const [session, setSession] = useState<LiveDraftSession | null>(null);
  const [participants, setParticipants] = useState<LiveDraftParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [pendingJoinTeam, setPendingJoinTeam] = useState<'team1' | 'team2' | null>(null);
  const [myDisplayName, setMyDisplayName] = useState<string | null>(null);
  const [defaultDisplayName, setDefaultDisplayName] = useState<string>('');
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const loadSession = useCallback(async () => {
    if (!sessionId) return;

    try {
      const [sessionData, participantsData] = await Promise.all([
        liveDraftService.getSession(sessionId),
        liveDraftService.getParticipants(sessionId),
      ]);

      if (!sessionData) {
        navigate('/live-draft');
        return;
      }

      setSession(sessionData);
      setParticipants(participantsData);
    } catch (err) {
      console.error('Failed to load session:', err);
      setError(err instanceof Error ? err.message : 'Failed to load session');
    }
  }, [sessionId]);

  // Sync auth state from store
  useEffect(() => {
    setCurrentUserId(authUser?.id ?? null);
    setDefaultDisplayName(authProfile?.displayName || '');
  }, [authUser, authProfile]);

  // Restore anonymous user's display name from localStorage
  useEffect(() => {
    if (!authUser && sessionId) {
      try {
        const savedDisplayName = localStorage.getItem(`live_draft_display_name_${sessionId}`);
        if (savedDisplayName) {
          setMyDisplayName(savedDisplayName);
        }
      } catch {
        // Ignore localStorage errors
      }
    }
  }, [authUser, sessionId]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      setError(null);
      await loadSession();
      setLoading(false);
    };

    if (sessionId) {
      init();
    }
  }, [sessionId, loadSession]);

  // Set up realtime subscription
  useEffect(() => {
    if (!sessionId || !supabase) return;

    const channel = supabase
      .channel(`live_draft_${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_draft_sessions',
          filter: `id=eq.${sessionId}`,
        },
        () => {
          loadSession();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_draft_participants',
          filter: `session_id=eq.${sessionId}`,
        },
        () => {
          loadSession();
        }
      )
      .subscribe();

    return () => {
      if (supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, [sessionId, loadSession]);

  const handleCopyLink = async () => {
    if (!session) return;
    const url = liveDraftService.getSessionUrl(session.invite_token);
    const success = await liveDraftService.copyToClipboard(url);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const joinTeamWithName = async (team: 'team1' | 'team2', displayName: string) => {
    if (!session) return;

    setShowJoinModal(false);
    setActionLoading(`join-${team}`);
    setError(null);

    try {
      await liveDraftService.joinAsTeamCaptain(session.id, team, displayName);
      setMyDisplayName(displayName);

      // Save display name to localStorage for anonymous users to persist across refreshes
      if (!currentUserId) {
        try {
          localStorage.setItem(`live_draft_display_name_${session.id}`, displayName);
        } catch {
          // Ignore localStorage errors
        }
      }

      await loadSession();
    } catch (err) {
      console.error('Failed to join as captain:', err);
      setError(err instanceof Error ? err.message : 'Failed to join');
    } finally {
      setActionLoading(null);
      setPendingJoinTeam(null);
    }
  };

  const handleJoinAsTeamCaptain = (team: 'team1' | 'team2') => {
    if (!session) return;

    // If logged in with a display name, join directly without modal
    if (currentUserId && defaultDisplayName) {
      joinTeamWithName(team, defaultDisplayName);
      return;
    }

    // Show modal for guests or users without display name
    setPendingJoinTeam(team);
    setShowJoinModal(true);
  };

  const handleJoinWithName = async (displayName: string) => {
    if (!session || !pendingJoinTeam) return;
    await joinTeamWithName(pendingJoinTeam, displayName);
  };

  const handleSelectSide = async (side: DraftSide) => {
    if (!session) return;

    setActionLoading(`side-${side}`);
    setError(null);

    // Determine which team for anonymous users
    const team = currentUserId
      ? undefined
      : session.team1_captain_display_name === myDisplayName
        ? 'team1'
        : 'team2';

    try {
      await liveDraftService.selectTeamSide(session.id, side, team);
      await loadSession();
    } catch (err) {
      console.error('Failed to select side:', err);
      setError(err instanceof Error ? err.message : 'Failed to select side');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSetReady = async (ready: boolean) => {
    if (!session) return;

    setActionLoading('ready');
    setError(null);

    // Determine which team for anonymous users
    const team = currentUserId
      ? undefined
      : session.team1_captain_display_name === myDisplayName
        ? 'team1'
        : 'team2';

    try {
      await liveDraftService.setReady(session.id, ready, team);
      await loadSession();
    } catch (err) {
      console.error('Failed to set ready:', err);
      setError(err instanceof Error ? err.message : 'Failed to update ready state');
    } finally {
      setActionLoading(null);
    }
  };

  const handleLeaveCaptainRole = async () => {
    if (!session) return;

    setActionLoading('leave');
    setError(null);

    // Determine which team for anonymous users
    let team: 'team1' | 'team2' | undefined = undefined;
    if (!currentUserId) {
      // For anonymous users, determine team by matching display name
      if (session.team1_captain_display_name === myDisplayName) {
        team = 'team1';
      } else if (session.team2_captain_display_name === myDisplayName) {
        team = 'team2';
      } else {
        // Fallback: check localStorage directly
        const storedName = localStorage.getItem(`live_draft_display_name_${session.id}`);
        if (storedName === session.team1_captain_display_name) {
          team = 'team1';
        } else if (storedName === session.team2_captain_display_name) {
          team = 'team2';
        }
      }

      console.log('Leave captain debug:', {
        myDisplayName,
        storedName: localStorage.getItem(`live_draft_display_name_${session.id}`),
        team1Captain: session.team1_captain_display_name,
        team2Captain: session.team2_captain_display_name,
        determinedTeam: team,
      });

      if (!team) {
        setError('Could not determine your team. Please try refreshing the page.');
        setActionLoading(null);
        return;
      }
    }

    try {
      await liveDraftService.leaveCaptainRole(session.id, team);
      setMyDisplayName(null);

      // Clear localStorage for anonymous users
      if (!currentUserId) {
        try {
          localStorage.removeItem(`live_draft_display_name_${session.id}`);
        } catch {
          // Ignore localStorage errors
        }
      }

      await loadSession();
    } catch (err) {
      console.error('Failed to leave captain role:', err);
      setError(err instanceof Error ? err.message : 'Failed to leave');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSwitchTeam = async (toTeam: 'team1' | 'team2') => {
    // Need session and a display name (either from joining or from profile for logged-in users)
    const displayNameToUse = currentUserId && defaultDisplayName ? defaultDisplayName : myDisplayName;
    if (!session || !displayNameToUse) return;

    setActionLoading(`switch-${toTeam}`);
    setError(null);

    // Determine current team for anonymous users
    const currentTeam = currentUserId
      ? undefined
      : session.team1_captain_display_name === displayNameToUse
        ? 'team1'
        : 'team2';

    // Save the current side before switching
    const currentSide = currentTeam === 'team1'
      ? session.team1_side
      : currentTeam === 'team2'
        ? session.team2_side
        : currentUserId
          ? session.team1_captain_id === currentUserId
            ? session.team1_side
            : session.team2_side
          : null;

    try {
      // First leave current captain role
      await liveDraftService.leaveCaptainRole(session.id, currentTeam);

      // Then join the new team
      await liveDraftService.joinAsTeamCaptain(session.id, toTeam, displayNameToUse);
      setMyDisplayName(displayNameToUse);

      // Restore the side selection on the new team
      if (currentSide) {
        await liveDraftService.selectTeamSide(session.id, currentSide, currentUserId ? undefined : toTeam);
      }

      await loadSession();
    } catch (err) {
      console.error('Failed to switch team:', err);
      setError(err instanceof Error ? err.message : 'Failed to switch team');
      // Reload session in case partial change happened
      await loadSession();
    } finally {
      setActionLoading(null);
    }
  };

  const handleJoinAsSpectator = async () => {
    if (!session) return;

    setActionLoading('spectator');
    setError(null);

    try {
      await liveDraftService.joinAsSpectator(session.id, defaultDisplayName || undefined);
      await loadSession();
    } catch (err) {
      console.error('Failed to join as spectator:', err);
      setError(err instanceof Error ? err.message : 'Failed to join as spectator');
    } finally {
      setActionLoading(null);
    }
  };

  const handleLeaveSpectator = async () => {
    if (!session) return;

    setActionLoading('leave-spectator');
    setError(null);

    try {
      await liveDraftService.leaveSession(session.id);
      await loadSession();
    } catch (err) {
      console.error('Failed to leave spectator:', err);
      setError(err instanceof Error ? err.message : 'Failed to leave spectator role');
    } finally {
      setActionLoading(null);
    }
  };

  const handleStartDraft = async () => {
    if (!session) return;

    setStarting(true);
    try {
      await liveDraftService.startSession(session.id);
      navigate(`/live-draft/${session.id}/game`);
    } catch (err) {
      console.error('Failed to start draft:', err);
      setError(err instanceof Error ? err.message : 'Failed to start draft');
    } finally {
      setStarting(false);
    }
  };

  // Determine user's role (supports both logged-in and anonymous users)
  // For anonymous users, also check localStorage directly in case state hasn't updated
  const storedDisplayName = !currentUserId && sessionId
    ? localStorage.getItem(`live_draft_display_name_${sessionId}`)
    : null;
  const effectiveDisplayName = myDisplayName || storedDisplayName;

  const isTeam1Captain = currentUserId
    ? session?.team1_captain_id === currentUserId
    : effectiveDisplayName
      ? session?.team1_captain_display_name === effectiveDisplayName
      : false;
  const isTeam2Captain = currentUserId
    ? session?.team2_captain_id === currentUserId
    : effectiveDisplayName
      ? session?.team2_captain_display_name === effectiveDisplayName
      : false;
  const isCaptain = isTeam1Captain || isTeam2Captain;

  // Debug logging for anonymous users
  if (!currentUserId && session) {
    console.log('Captain detection:', {
      myDisplayName,
      storedDisplayName,
      effectiveDisplayName,
      team1CaptainDisplayName: session.team1_captain_display_name,
      team2CaptainDisplayName: session.team2_captain_display_name,
      isTeam1Captain,
      isTeam2Captain,
    });
  }

  // Get my captain's team info
  const myTeam = isTeam1Captain ? 'team1' : isTeam2Captain ? 'team2' : null;
  const mySide = myTeam === 'team1' ? session?.team1_side : myTeam === 'team2' ? session?.team2_side : null;
  const myReady = myTeam === 'team1' ? session?.team1_ready : myTeam === 'team2' ? session?.team2_ready : false;

  // Get participant info
  const spectators = participants.filter((p) => p.participant_type === 'spectator');

  // For logged-in users, match by user_id. For anonymous users, match by stored participant ID.
  const myParticipant = currentUserId
    ? participants.find((p) => p.user_id === currentUserId)
    : (() => {
        try {
          const storedParticipantId = localStorage.getItem(`live_draft_participant_${sessionId}`);
          return storedParticipantId ? participants.find((p) => p.id === storedParticipantId) : undefined;
        } catch {
          return undefined;
        }
      })();
  const isSpectator = myParticipant?.participant_type === 'spectator';

  // Check if both teams are ready to start
  // Support both logged-in captains (have captain_id) and anonymous captains (have captain_display_name)
  const hasTeam1Captain = !!(session?.team1_captain_id || session?.team1_captain_display_name);
  const hasTeam2Captain = !!(session?.team2_captain_id || session?.team2_captain_display_name);
  const bothTeamsReady =
    hasTeam1Captain &&
    hasTeam2Captain &&
    session?.team1_side &&
    session?.team2_side &&
    session?.team1_ready &&
    session?.team2_ready;
  const canStart = bothTeamsReady && session?.status === 'lobby';

  // Helper to get captain display name for a team
  const getCaptainDisplayName = (team: 'team1' | 'team2'): string | null => {
    const captainId = team === 'team1' ? session?.team1_captain_id : session?.team2_captain_id;
    const displayNameField = team === 'team1' ? session?.team1_captain_display_name : session?.team2_captain_display_name;

    // Return display name if set (works for both logged-in and anonymous captains)
    if (displayNameField) return displayNameField;

    // For logged-in captains, check participant/profile
    if (captainId) {
      const participant = participants.find((p) => p.user_id === captainId && p.is_captain);
      if (participant?.profile?.display_name) return participant.profile.display_name;
      if (participant?.display_name) return participant.display_name;
      return 'Captain';
    }

    return null;
  };

  // Check if current user is the session creator
  const isCreator = !!currentUserId && session?.created_by === currentUserId;

  // Check which sides are taken
  const blueTaken = session?.team1_side === 'blue' || session?.team2_side === 'blue';
  const redTaken = session?.team1_side === 'red' || session?.team2_side === 'red';

  const handleDeleteSession = async () => {
    if (!session) return;
    setActionLoading('delete');
    setError(null);
    try {
      await liveDraftService.deleteSession(session.id);
      navigate('/live-draft');
    } catch (err) {
      console.error('Failed to delete session:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete session');
      setShowDeleteConfirm(false);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex items-center gap-3 text-gray-400">
          <svg className="animate-spin h-6 w-6" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Loading session...
        </div>
      </div>
    );
  }

  if (error && !session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="text-red-400 text-lg">{error}</div>
        <Button variant="secondary" onClick={() => navigate('/')}>
          Go Home
        </Button>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center relative">
        {/* Settings gear — creator only */}
        {isCreator && (
          <div className="absolute right-0 top-0">
            <button
              onClick={() => {
                setShowSettingsMenu(!showSettingsMenu);
                setShowDeleteConfirm(false);
              }}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-lol-surface transition-colors"
              title="Session settings"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>

            {showSettingsMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => {
                  setShowSettingsMenu(false);
                  setShowDeleteConfirm(false);
                }} />
                <div className="absolute right-0 top-full mt-1 z-20 w-56 bg-lol-card border border-lol-border rounded-lg shadow-xl shadow-black/50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                  {showDeleteConfirm ? (
                    <div className="p-3 bg-red-500/5">
                      <p className="text-xs text-gray-300 mb-2">Permanently delete this session and all data?</p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleDeleteSession}
                          disabled={actionLoading === 'delete'}
                          className="flex-1 px-3 py-1.5 rounded text-xs font-medium bg-red-600 text-white hover:bg-red-500 transition-colors disabled:opacity-50"
                        >
                          {actionLoading === 'delete' ? 'Deleting...' : 'Confirm Delete'}
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(false)}
                          disabled={actionLoading === 'delete'}
                          className="px-3 py-1.5 rounded text-xs text-gray-400 hover:text-white hover:bg-lol-surface transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete Session
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        <h1 className="text-3xl font-bold text-white mb-2">{session.name}</h1>
        <div className="flex items-center justify-center gap-4 text-gray-400">
          <span className="px-3 py-1 rounded-full bg-lol-surface border border-lol-border text-sm">
            {DRAFT_MODE_LABELS[session.draft_mode]}
          </span>
          <span>Best of {session.planned_games}</span>
          <span>{session.pick_time_seconds}s timer</span>
        </div>
        <p className="text-gray-500 text-sm mt-2">
          {DRAFT_MODE_DESCRIPTIONS[session.draft_mode]}
        </p>
      </div>

      {/* Error message */}
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm text-center">
          {error}
        </div>
      )}

      {/* Teams Display */}
      <div className="grid grid-cols-2 gap-6">
        {/* Team 1 Card */}
        <TeamCard
          teamName={session.team1_name}
          captainId={session.team1_captain_id}
          captainDisplayName={getCaptainDisplayName('team1')}
          captainAvatarUrl={session.team1_captain_avatar_url}
          captainRole={session.team1_captain_role}
          captainRoleTeamName={session.team1_captain_role_team_name}
          side={session.team1_side}
          ready={session.team1_ready ?? false}
          isMe={!!isTeam1Captain}
          canJoin={!isCaptain && !isSpectator && !session.team1_captain_id && !session.team1_captain_display_name}
          canSwitch={!!isTeam2Captain && !session.team1_captain_id && !session.team1_captain_display_name}
          onJoin={() => handleJoinAsTeamCaptain('team1')}
          onLeave={isTeam1Captain ? handleLeaveCaptainRole : undefined}
          onSwitch={isTeam2Captain ? () => handleSwitchTeam('team1') : undefined}
          loading={actionLoading === 'join-team1' || actionLoading === 'switch-team1'}
          leaveLoading={actionLoading === 'leave'}
        />

        {/* Team 2 Card */}
        <TeamCard
          teamName={session.team2_name}
          captainId={session.team2_captain_id}
          captainDisplayName={getCaptainDisplayName('team2')}
          captainAvatarUrl={session.team2_captain_avatar_url}
          captainRole={session.team2_captain_role}
          captainRoleTeamName={session.team2_captain_role_team_name}
          side={session.team2_side}
          ready={session.team2_ready ?? false}
          isMe={!!isTeam2Captain}
          canJoin={!isCaptain && !isSpectator && !session.team2_captain_id && !session.team2_captain_display_name}
          canSwitch={!!isTeam1Captain && !session.team2_captain_id && !session.team2_captain_display_name}
          onJoin={() => handleJoinAsTeamCaptain('team2')}
          onLeave={isTeam2Captain ? handleLeaveCaptainRole : undefined}
          onSwitch={isTeam1Captain ? () => handleSwitchTeam('team2') : undefined}
          loading={actionLoading === 'join-team2' || actionLoading === 'switch-team2'}
          leaveLoading={actionLoading === 'leave'}
        />
      </div>

      {/* Side Selection for Captains */}
      {isCaptain && (
        <Card className="text-center">
          <h3 className="text-lg font-semibold text-white mb-4">
            {mySide ? 'Your Side' : 'Choose Your Side'}
          </h3>
          <p className="text-gray-400 mb-6">
            {mySide
              ? `${myTeam === 'team1' ? session.team1_name : session.team2_name} is on ${mySide === 'blue' ? 'Blue' : 'Red'} Side`
              : `Select which side ${myTeam === 'team1' ? session.team1_name : session.team2_name} will play on`}
          </p>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => handleSelectSide('blue')}
              disabled={actionLoading !== null || (blueTaken && mySide !== 'blue')}
              className={`p-6 rounded-2xl border-2 transition-all relative ${
                mySide === 'blue'
                  ? 'border-blue-500 bg-blue-500/20 ring-2 ring-blue-500/50'
                  : blueTaken
                    ? 'bg-blue-500/5 border-blue-500/20 opacity-50 cursor-not-allowed'
                    : 'border-blue-500/30 bg-blue-500/5 hover:border-blue-500 hover:bg-blue-500/10'
              }`}
            >
              {mySide === 'blue' && (
                <div className="absolute top-2 right-2">
                  <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
              {actionLoading === 'side-blue' ? (
                <svg className="animate-spin h-8 w-8 mx-auto text-blue-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <>
                  <h4 className="text-xl font-bold text-blue-400">Blue Side</h4>
                  <p className="text-blue-400/60 text-sm mt-1">First pick</p>
                  {blueTaken && mySide !== 'blue' && <p className="text-red-400/80 text-xs mt-2">Already taken</p>}
                </>
              )}
            </button>
            <button
              onClick={() => handleSelectSide('red')}
              disabled={actionLoading !== null || (redTaken && mySide !== 'red')}
              className={`p-6 rounded-2xl border-2 transition-all relative ${
                mySide === 'red'
                  ? 'border-red-500 bg-red-500/20 ring-2 ring-red-500/50'
                  : redTaken
                    ? 'bg-red-500/5 border-red-500/20 opacity-50 cursor-not-allowed'
                    : 'border-red-500/30 bg-red-500/5 hover:border-red-500 hover:bg-red-500/10'
              }`}
            >
              {mySide === 'red' && (
                <div className="absolute top-2 right-2">
                  <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
              {actionLoading === 'side-red' ? (
                <svg className="animate-spin h-8 w-8 mx-auto text-red-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <>
                  <h4 className="text-xl font-bold text-red-400">Red Side</h4>
                  <p className="text-red-400/60 text-sm mt-1">Counter pick</p>
                  {redTaken && mySide !== 'red' && <p className="text-red-400/80 text-xs mt-2">Already taken</p>}
                </>
              )}
            </button>
          </div>
        </Card>
      )}

      {/* Ready Controls for Captains (shown when captain and side is selected) */}
      {isCaptain && mySide && (
        <div className="flex flex-col items-center gap-4">
          <Button
            size="lg"
            variant={myReady ? 'secondary' : 'primary'}
            onClick={() => handleSetReady(!myReady)}
            disabled={actionLoading === 'ready'}
            className={myReady ? 'bg-green-600 hover:bg-green-700 border-green-500' : ''}
          >
            {actionLoading === 'ready' ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Updating...
              </span>
            ) : myReady ? (
              <span className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Ready! (Click to unready)
              </span>
            ) : (
              'Ready Up'
            )}
          </Button>
        </div>
      )}

      {/* Spectator Button (for non-participants) */}
      {!isCaptain && !isSpectator && !myParticipant && (
        <div className="flex justify-center">
          <Button
            variant="secondary"
            onClick={handleJoinAsSpectator}
            disabled={actionLoading === 'spectator'}
          >
            {actionLoading === 'spectator' ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Joining...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Join as Spectator
              </span>
            )}
          </Button>
        </div>
      )}

      {/* Invite Link */}
      <Card>
        <h3 className="text-lg font-semibold text-white mb-4">Invite Link</h3>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="px-3 py-2 bg-lol-dark rounded-lg text-sm text-gray-300 truncate">
              {liveDraftService.getSessionUrl(session.invite_token)}
            </div>
          </div>
          <Button
            variant={copied ? 'secondary' : 'outline'}
            size="sm"
            onClick={handleCopyLink}
          >
            {copied ? 'Copied!' : 'Copy'}
          </Button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Share this link with others to join the draft
        </p>
      </Card>

      {/* Spectator Count */}
      {spectators.length > 0 && (
        <div className="flex items-center justify-center gap-2 text-gray-400">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          <span>{spectators.length} spectator{spectators.length !== 1 ? 's' : ''}</span>
        </div>
      )}

      {/* Start Button - Only show for captains when both ready */}
      {isCaptain && (
        <div className="flex justify-center">
          <Button size="lg" disabled={!canStart || starting} onClick={handleStartDraft}>
            {starting ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Starting...
              </span>
            ) : canStart ? (
              'Start Draft'
            ) : (
              'Waiting for both teams to be ready...'
            )}
          </Button>
        </div>
      )}

      {/* Status messages */}
      {isSpectator && (
        <div className="flex flex-col items-center gap-3">
          <p className="text-gray-400 text-sm">
            You are spectating this draft. Waiting for both teams to be ready...
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleLeaveSpectator}
            disabled={actionLoading === 'leave-spectator'}
          >
            {actionLoading === 'leave-spectator' ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Leaving...
              </span>
            ) : (
              'Leave Spectator Role'
            )}
          </Button>
        </div>
      )}

      {/* Join Team Modal for entering display name */}
      <JoinTeamModal
        isOpen={showJoinModal}
        onClose={() => {
          setShowJoinModal(false);
          setPendingJoinTeam(null);
        }}
        onJoin={handleJoinWithName}
        teamName={pendingJoinTeam === 'team1' ? session.team1_name : pendingJoinTeam === 'team2' ? session.team2_name : ''}
        defaultName={myDisplayName || defaultDisplayName}
        isLoading={actionLoading?.startsWith('join-') || false}
      />
    </div>
  );
}

// Team Card Component
interface TeamCardProps {
  teamName: string;
  captainId: string | null;
  captainDisplayName: string | null;
  captainAvatarUrl: string | null;
  captainRole: string | null;
  captainRoleTeamName: string | null;
  side: DraftSide | null;
  ready: boolean;
  isMe: boolean | '' | null;
  canJoin: boolean;
  canSwitch: boolean; // Can current user switch to this team (they're captain of other team)
  onJoin: () => void;
  onLeave?: () => void;
  onSwitch?: () => void;
  loading: boolean;
  leaveLoading?: boolean;
}

function TeamCard({
  teamName,
  captainId,
  captainDisplayName,
  captainAvatarUrl,
  captainRole,
  captainRoleTeamName,
  side,
  ready,
  isMe,
  canJoin,
  canSwitch,
  onJoin,
  onLeave,
  onSwitch,
  loading,
  leaveLoading,
}: TeamCardProps) {
  // A captain exists if there's either a logged-in captain (captainId) or an anonymous captain (captainDisplayName)
  const hasCaptain = !!captainId || !!captainDisplayName;

  // Determine card styling based on state
  const getBorderColor = () => {
    if (!hasCaptain) return 'border-lol-border';
    if (ready) return 'border-green-400/60';
    if (side === 'blue') return 'border-blue-500/50';
    if (side === 'red') return 'border-red-500/50';
    return 'border-lol-gold/50';
  };

  const getBackgroundColor = () => {
    if (!hasCaptain) return 'bg-lol-surface';
    if (ready) return 'bg-green-500/10';
    if (side === 'blue') return 'bg-blue-500/10';
    if (side === 'red') return 'bg-red-500/10';
    return 'bg-lol-gold/10';
  };

  const getGlowClass = () => {
    if (ready) return 'shadow-[0_0_16px_rgba(74,222,128,0.3)]';
    return '';
  };

  const getSideLabel = () => {
    if (!side) return 'Choosing side...';
    return side === 'blue' ? 'Blue Side' : 'Red Side';
  };

  const getSideLabelColor = () => {
    if (!side) return 'text-lol-gold';
    return side === 'blue' ? 'text-blue-400' : 'text-red-400';
  };

  return (
    <div className={`p-6 rounded-2xl border-2 transition-all duration-300 ${getBorderColor()} ${getBackgroundColor()} ${getGlowClass()}`}>
      <div className="text-center mb-4">
        <h2 className="text-xl font-bold text-white">{teamName}</h2>
        {hasCaptain && (
          <p className={`text-sm ${getSideLabelColor()}`}>{getSideLabel()}</p>
        )}
      </div>

      {hasCaptain ? (
        <div className="space-y-3">
          {/* Captain Info */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-black/20 border border-white/10">
            {captainAvatarUrl ? (
              <img src={captainAvatarUrl} alt="" className="w-10 h-10 rounded-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                side === 'blue' ? 'bg-blue-500/20' : side === 'red' ? 'bg-red-500/20' : 'bg-lol-gold/20'
              }`}>
                <svg className={`w-5 h-5 ${
                  side === 'blue' ? 'text-blue-400' : side === 'red' ? 'text-red-400' : 'text-lol-gold'
                }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="font-medium text-white truncate">
                {captainDisplayName}
                {isMe && <span className="text-lol-gold ml-2">(You)</span>}
              </div>
              {captainRole && (
                <div className="text-xs text-lol-gold">
                  {captainRole.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                  {captainRoleTeamName && ` of ${captainRoleTeamName}`}
                </div>
              )}
            </div>
            {/* Leave button for current user */}
            {isMe && onLeave && (
              <button
                onClick={onLeave}
                disabled={leaveLoading}
                className="p-1.5 rounded-lg hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-all"
                title="Leave captain role"
              >
                {leaveLoading ? (
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                )}
              </button>
            )}
          </div>

          {/* Ready Status */}
          <div className={`flex items-center justify-center gap-2 py-2 rounded-lg ${
            ready ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
          }`}>
            {ready ? (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Ready
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {side ? 'Not Ready' : 'Selecting Side'}
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="p-4 rounded-xl border-2 border-dashed border-white/20 text-center">
            <div className="text-gray-400">No captain yet</div>
          </div>

          {canJoin && (
            <Button
              className="w-full"
              onClick={onJoin}
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Joining...
                </span>
              ) : (
                `Join as ${teamName}`
              )}
            </Button>
          )}

          {canSwitch && onSwitch && (
            <Button
              className="w-full"
              variant="secondary"
              onClick={onSwitch}
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Switching...
                </span>
              ) : (
                `Switch to ${teamName}`
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
