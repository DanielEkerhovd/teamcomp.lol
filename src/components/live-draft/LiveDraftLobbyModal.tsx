import { useState } from 'react';
import { liveDraftService } from '../../lib/liveDraftService';
import { Button, Modal } from '../ui';
import JoinTeamModal from './JoinTeamModal';
import type {
  LiveDraftSession,
  LiveDraftParticipant,
  DraftSide,
  DraftMode,
} from '../../types/liveDraft';

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

interface LiveDraftLobbyModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: LiveDraftSession;
  participants: LiveDraftParticipant[];
  currentUserId: string | null;
  myDisplayName: string | null;
  setMyDisplayName: (name: string | null) => void;
  defaultDisplayName: string;
  loadSession: () => Promise<void>;
  setError: (error: string | null) => void;
}

export default function LiveDraftLobbyModal({
  isOpen,
  onClose,
  session,
  participants,
  currentUserId,
  myDisplayName,
  setMyDisplayName,
  defaultDisplayName,
  loadSession,
  setError,
}: LiveDraftLobbyModalProps) {
  const [copied, setCopied] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [pendingJoinTeam, setPendingJoinTeam] = useState<'team1' | 'team2' | null>(null);

  const handleCopyLink = async () => {
    const url = liveDraftService.getSessionUrl(session.invite_token);
    const success = await liveDraftService.copyToClipboard(url);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const joinTeamWithName = async (team: 'team1' | 'team2', displayName: string) => {
    setShowJoinModal(false);
    setActionLoading(`join-${team}`);
    setError(null);

    try {
      await liveDraftService.joinAsTeamCaptain(session.id, team, displayName);
      setMyDisplayName(displayName);

      // Save display name to localStorage for anonymous users
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
    if (currentUserId && defaultDisplayName) {
      joinTeamWithName(team, defaultDisplayName);
      return;
    }
    setPendingJoinTeam(team);
    setShowJoinModal(true);
  };

  const handleJoinWithName = async (displayName: string) => {
    if (!pendingJoinTeam) return;
    await joinTeamWithName(pendingJoinTeam, displayName);
  };

  const handleSelectSide = async (side: DraftSide) => {
    setActionLoading(`side-${side}`);
    setError(null);

    // Get effective display name from state or localStorage
    const effectiveDisplayName = myDisplayName || localStorage.getItem(`live_draft_display_name_${session.id}`);

    let team: 'team1' | 'team2' | undefined = undefined;
    if (!currentUserId && effectiveDisplayName) {
      if (session.team1_captain_display_name === effectiveDisplayName) {
        team = 'team1';
      } else if (session.team2_captain_display_name === effectiveDisplayName) {
        team = 'team2';
      }
    }

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

  const handleLeaveCaptainRole = async () => {
    setActionLoading('leave');
    setError(null);

    // Get effective display name from state or localStorage
    const effectiveDisplayName = myDisplayName || localStorage.getItem(`live_draft_display_name_${session.id}`);

    let team: 'team1' | 'team2' | undefined = undefined;
    if (!currentUserId && effectiveDisplayName) {
      if (session.team1_captain_display_name === effectiveDisplayName) {
        team = 'team1';
      } else if (session.team2_captain_display_name === effectiveDisplayName) {
        team = 'team2';
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
    const displayNameToUse = currentUserId && defaultDisplayName ? defaultDisplayName : myDisplayName;
    if (!displayNameToUse) return;

    setActionLoading(`switch-${toTeam}`);
    setError(null);

    const currentTeam = currentUserId
      ? undefined
      : session.team1_captain_display_name === displayNameToUse
        ? 'team1'
        : 'team2';

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
      await liveDraftService.leaveCaptainRole(session.id, currentTeam);
      await liveDraftService.joinAsTeamCaptain(session.id, toTeam, displayNameToUse);
      setMyDisplayName(displayNameToUse);

      if (currentSide) {
        await liveDraftService.selectTeamSide(session.id, currentSide, currentUserId ? undefined : toTeam);
      }

      await loadSession();
    } catch (err) {
      console.error('Failed to switch team:', err);
      setError(err instanceof Error ? err.message : 'Failed to switch team');
      await loadSession();
    } finally {
      setActionLoading(null);
    }
  };

  const handleJoinAsSpectator = async () => {
    setActionLoading('spectator');
    setError(null);

    try {
      await liveDraftService.joinAsSpectator(session.id);
      await loadSession();
    } catch (err) {
      console.error('Failed to join as spectator:', err);
      setError(err instanceof Error ? err.message : 'Failed to join as spectator');
    } finally {
      setActionLoading(null);
    }
  };

  const handleLeaveSpectator = async () => {
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

  // Determine user's role
  // For anonymous users, also check localStorage directly in case state hasn't updated yet
  const storedDisplayName = !currentUserId
    ? (() => {
        try {
          return localStorage.getItem(`live_draft_display_name_${session.id}`);
        } catch {
          return null;
        }
      })()
    : null;
  const effectiveDisplayNameForDetection = myDisplayName || storedDisplayName;

  const isTeam1Captain = currentUserId
    ? session.team1_captain_id === currentUserId
    : effectiveDisplayNameForDetection
      ? session.team1_captain_display_name === effectiveDisplayNameForDetection
      : false;
  const isTeam2Captain = currentUserId
    ? session.team2_captain_id === currentUserId
    : effectiveDisplayNameForDetection
      ? session.team2_captain_display_name === effectiveDisplayNameForDetection
      : false;
  const isCaptain = isTeam1Captain || isTeam2Captain;

  const myTeam = isTeam1Captain ? 'team1' : isTeam2Captain ? 'team2' : null;
  const mySide = myTeam === 'team1' ? session.team1_side : myTeam === 'team2' ? session.team2_side : null;

  // Get participant info
  const spectators = participants.filter((p) => p.participant_type === 'spectator');
  const myParticipant = currentUserId
    ? participants.find((p) => p.user_id === currentUserId)
    : (() => {
        try {
          const storedParticipantId = localStorage.getItem(`live_draft_participant_${session.id}`);
          return storedParticipantId ? participants.find((p) => p.id === storedParticipantId) : undefined;
        } catch {
          return undefined;
        }
      })();
  const isSpectator = myParticipant?.participant_type === 'spectator';

  // Helper to get captain display name for a team
  const getCaptainDisplayName = (team: 'team1' | 'team2'): string | null => {
    const captainId = team === 'team1' ? session.team1_captain_id : session.team2_captain_id;
    const displayNameField = team === 'team1' ? session.team1_captain_display_name : session.team2_captain_display_name;

    if (displayNameField) return displayNameField;

    if (captainId) {
      const participant = participants.find((p) => p.user_id === captainId && p.is_captain);
      if (participant?.profile?.display_name) return participant.profile.display_name;
      if (participant?.display_name) return participant.display_name;
      return 'Captain';
    }

    return null;
  };

  // Check which sides are taken
  const blueTaken = session.team1_side === 'blue' || session.team2_side === 'blue';
  const redTaken = session.team1_side === 'red' || session.team2_side === 'red';

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Draft Lobby"
        size="xl"
      >
        <div className="space-y-4">
          {/* Session Info */}
          <div className="text-center pb-4 border-b border-lol-border">
            <h2 className="text-2xl font-bold text-white mb-2">{session.name}</h2>
            <div className="flex items-center justify-center gap-4 text-gray-400 text-sm">
              <span className="px-2 py-0.5 rounded bg-lol-surface font-medium">
                {DRAFT_MODE_LABELS[session.draft_mode]}
              </span>
              <span>Best of {session.planned_games}</span>
              <span>{session.pick_time_seconds}s timer</span>
            </div>
          </div>

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
            <div className="text-center p-5 bg-lol-dark rounded-xl">
              <h3 className="text-base font-semibold text-white mb-4">
                {mySide ? 'Your Side' : 'Choose Your Side'}
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => handleSelectSide('blue')}
                  disabled={actionLoading !== null || (blueTaken && mySide !== 'blue')}
                  className={`py-6 px-4 rounded-xl border-2 transition-all relative ${
                    mySide === 'blue'
                      ? 'border-blue-500 bg-blue-500/20 ring-2 ring-blue-500/50'
                      : blueTaken
                        ? 'bg-blue-500/5 border-blue-500/20 opacity-50 cursor-not-allowed'
                        : 'border-blue-500/30 bg-blue-500/5 hover:border-blue-500 hover:bg-blue-500/10'
                  }`}
                >
                  {mySide === 'blue' && (
                    <div className="absolute top-1.5 right-1.5">
                      <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                  {actionLoading === 'side-blue' ? (
                    <svg className="animate-spin h-6 w-6 mx-auto text-blue-400" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : (
                    <>
                      <h4 className="text-xl font-bold text-blue-400">Blue Side</h4>
                      <p className="text-blue-400/60 text-sm mt-1">First pick</p>
                      {blueTaken && mySide !== 'blue' && <p className="text-red-400/80 text-xs mt-2">Taken</p>}
                    </>
                  )}
                </button>
                <button
                  onClick={() => handleSelectSide('red')}
                  disabled={actionLoading !== null || (redTaken && mySide !== 'red')}
                  className={`py-10 px-4 rounded-xl border-2 transition-all relative ${
                    mySide === 'red'
                      ? 'border-red-500 bg-red-500/20 ring-2 ring-red-500/50'
                      : redTaken
                        ? 'bg-red-500/5 border-red-500/20 opacity-50 cursor-not-allowed'
                        : 'border-red-500/30 bg-red-500/5 hover:border-red-500 hover:bg-red-500/10'
                  }`}
                >
                  {mySide === 'red' && (
                    <div className="absolute top-1.5 right-1.5">
                      <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                  {actionLoading === 'side-red' ? (
                    <svg className="animate-spin h-6 w-6 mx-auto text-red-400" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : (
                    <>
                      <h4 className="text-xl font-bold text-red-400">Red Side</h4>
                      <p className="text-red-400/60 text-sm mt-1">Counter pick</p>
                      {redTaken && mySide !== 'red' && <p className="text-red-400/80 text-xs mt-2">Taken</p>}
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Spectator Button */}
          {!isCaptain && !isSpectator && !myParticipant && (
            <div className="flex justify-center">
              <Button
                variant="secondary"
                size="sm"
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
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    Join as Spectator
                  </span>
                )}
              </Button>
            </div>
          )}

          {isSpectator && (
            <div className="flex items-center justify-center gap-3 text-gray-400 text-sm">
              <span>You are spectating</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLeaveSpectator}
                disabled={actionLoading === 'leave-spectator'}
              >
                {actionLoading === 'leave-spectator' ? 'Leaving...' : 'Leave'}
              </Button>
            </div>
          )}

          {/* Invite Link */}
          <div className="p-3 bg-lol-dark rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <h4 className="text-sm font-medium text-white">Invite Link</h4>
              {spectators.length > 0 && (
                <span className="text-xs text-gray-500">
                  {spectators.length} spectator{spectators.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 px-3 py-2 bg-lol-surface rounded text-sm text-gray-400 truncate">
                {liveDraftService.getSessionUrl(session.invite_token)}
              </div>
              <Button
                variant={copied ? 'secondary' : 'outline'}
                size="sm"
                onClick={handleCopyLink}
              >
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
          </div>

          {/* Close button hint */}
          {isCaptain && mySide && (
            <p className="text-center text-gray-500 text-xs">
              Close this modal to start planning. Ready up on the main screen when you're set.
            </p>
          )}
        </div>
      </Modal>

      {/* Join Team Modal */}
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
    </>
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
  canSwitch: boolean;
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
  const hasCaptain = !!captainId || !!captainDisplayName;

  const getBorderColor = () => {
    if (!hasCaptain) return 'border-lol-border';
    if (side === 'blue') return ready ? 'border-blue-500' : 'border-blue-500/50';
    if (side === 'red') return ready ? 'border-red-500' : 'border-red-500/50';
    return 'border-lol-gold/50';
  };

  const getBackgroundColor = () => {
    if (!hasCaptain) return 'bg-lol-surface';
    if (side === 'blue') return ready ? 'bg-blue-500/20' : 'bg-blue-500/10';
    if (side === 'red') return ready ? 'bg-red-500/20' : 'bg-red-500/10';
    return 'bg-lol-gold/10';
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
    <div className={`px-4 py-8 rounded-xl border-2 transition-all ${getBorderColor()} ${getBackgroundColor()}`}>
      <div className="text-center mb-2">
        <h3 className="text-lg font-bold text-white">{teamName}</h3>
        {hasCaptain && (
          <p className={`text-xs ${getSideLabelColor()}`}>{getSideLabel()}</p>
        )}
      </div>

      {hasCaptain ? (
        <div className="space-y-2">
          {/* Captain Info */}
          <div className="flex items-center gap-2 px-4 min-h-20 rounded-lg bg-black/20 border border-white/10">
            {captainAvatarUrl ? (
              <img src={captainAvatarUrl} alt="" className="w-8 h-8 rounded-full" />
            ) : (
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                side === 'blue' ? 'bg-blue-500/20' : side === 'red' ? 'bg-red-500/20' : 'bg-lol-gold/20'
              }`}>
                <svg className={`w-4 h-4 ${
                  side === 'blue' ? 'text-blue-400' : side === 'red' ? 'text-red-400' : 'text-lol-gold'
                }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="font-medium text-white truncate">
                {captainDisplayName}
                {isMe && <span className="text-lol-gold ml-1">(You)</span>}
              </div>
              {captainRole && (
                <div className="text-xs text-lol-gold">
                  {captainRole.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                  {captainRoleTeamName && ` of ${captainRoleTeamName}`}
                </div>
              )}
            </div>
            {isMe && onLeave && (
              <button
                onClick={onLeave}
                disabled={leaveLoading}
                className="p-1.5 rounded hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-all"
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
          <div className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium ${
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
        <div className="space-y-2">
          <div className="p-3 rounded-lg border-2 border-dashed border-white/20 text-center">
            <div className="text-gray-400 text-sm">No captain yet</div>
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
