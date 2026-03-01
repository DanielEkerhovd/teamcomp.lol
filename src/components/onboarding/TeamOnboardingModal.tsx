import { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/useAuthStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { useMyTeamStore } from '../../stores/useMyTeamStore';
import { useFriendsStore } from '../../stores/useFriendsStore';
import { teamMembershipService } from '../../lib/teamMembershipService';
import { syncManager } from '../../lib/syncManager';
import type { Friend } from '../../types/database';

interface InviteResult {
  name: string;
  success: boolean;
  error?: string;
}

export function TeamOnboardingContent({ testMode, onClose }: { testMode?: boolean; onClose?: () => void }) {
  const addTeam = useMyTeamStore((s) => s.addTeam);

  // Step state
  const [step, setStep] = useState<'create' | 'invite'>('create');

  // Create step state
  const [teamName, setTeamName] = useState('');
  const [teamNameError, setTeamNameError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createdTeamId, setCreatedTeamId] = useState<string | null>(null);

  // Invite step state
  const [identifier, setIdentifier] = useState('');
  const [sending, setSending] = useState(false);
  const [sendingFriendId, setSendingFriendId] = useState<string | null>(null);
  const [inviteResults, setInviteResults] = useState<InviteResult[]>([]);
  const [teamSynced, setTeamSynced] = useState(false);

  // Friends
  const friends = useFriendsStore((s) => s.friends);
  const loadFriends = useFriendsStore((s) => s.loadFriends);

  const { completeTeamOnboarding } = useSettingsStore();

  // Load friends when entering invite step
  useEffect(() => {
    if (step === 'invite' && !testMode) {
      loadFriends();
    }
  }, [step, loadFriends, testMode]);

  const handleCreateTeam = async () => {
    const trimmed = teamName.trim();

    if (!trimmed) {
      setTeamNameError('Team name cannot be empty');
      return;
    }

    if (trimmed.length < 2) {
      setTeamNameError('Team name must be at least 2 characters');
      return;
    }

    if (testMode) {
      // Dry run: just advance to step 2 without creating anything
      setIsCreating(true);
      await new Promise((r) => setTimeout(r, 500));
      setCreatedTeamId('test-team-id');
      setTeamSynced(true);
      setIsCreating(false);
      setStep('invite');
      return;
    }

    setIsCreating(true);
    setTeamNameError(null);

    // Check global availability
    const availability = await useMyTeamStore.getState().checkTeamNameGloballyAvailable(trimmed);
    if (!availability.available) {
      setTeamNameError(availability.error || 'That team name is already taken');
      setIsCreating(false);
      return;
    }

    const result = addTeam(trimmed);

    if (!result.success) {
      setTeamNameError(
        result.error === 'duplicate_name'
          ? 'That team name is already taken'
          : 'Maximum teams reached'
      );
      setIsCreating(false);
      return;
    }

    setCreatedTeamId(result.team!.id);

    // Force sync so the team exists in Supabase for invites
    try {
      await syncManager.forceSync('my-teams');
      setTeamSynced(true);
    } catch {
      // Sync failed but team was created locally - still advance
      setTeamSynced(false);
    }

    setIsCreating(false);
    setStep('invite');
  };

  const handleSendInvite = async (targetIdentifier?: string) => {
    const target = targetIdentifier || identifier.trim();
    if (!target || sending) return;

    if (testMode) {
      // Dry run: fake a successful invite
      setSending(true);
      await new Promise((r) => setTimeout(r, 400));
      setInviteResults((prev) => [
        ...prev,
        { name: target, success: true },
      ]);
      if (!targetIdentifier) setIdentifier('');
      setSending(false);
      return;
    }

    if (!createdTeamId) return;

    setSending(true);

    const result = await teamMembershipService.sendTeamInvite(
      createdTeamId,
      target,
      'player'
    );

    setInviteResults((prev) => [
      ...prev,
      {
        name: result.targetUser?.displayName || target,
        success: result.success,
        error: result.error,
      },
    ]);

    if (result.success && !targetIdentifier) {
      setIdentifier('');
    }

    setSending(false);
  };

  const handleInviteFriend = async (friend: Friend) => {
    if (sending || sendingFriendId) return;
    setSendingFriendId(friend.friendId);

    if (testMode) {
      await new Promise((r) => setTimeout(r, 400));
      setInviteResults((prev) => [
        ...prev,
        { name: friend.displayName, success: true },
      ]);
      setSendingFriendId(null);
      return;
    }

    const result = await teamMembershipService.sendTeamInvite(
      createdTeamId!,
      friend.displayName,
      'player'
    );

    setInviteResults((prev) => [
      ...prev,
      {
        name: result.targetUser?.displayName || friend.displayName,
        success: result.success,
        error: result.error,
      },
    ]);

    setSendingFriendId(null);
  };

  const handleDismiss = () => {
    if (testMode) {
      onClose?.();
    } else {
      completeTeamOnboarding();
    }
  };

  // Derive which friends are already invited
  const invitedNames = new Set(inviteResults.filter((r) => r.success).map((r) => r.name.toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-lg mx-4 bg-lol-card border border-lol-border rounded-2xl shadow-2xl shadow-black/50">
        {/* Test mode banner */}
        {testMode && (
          <div className="px-4 py-2 bg-purple-500/20 border-b border-purple-500/30 rounded-t-2xl text-center">
            <span className="text-xs font-medium text-purple-400">TEST MODE — no data will be saved</span>
          </div>
        )}

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 pt-6">
          <div className={`w-2 h-2 rounded-full transition-colors ${step === 'create' ? 'bg-lol-gold' : 'bg-gray-600'}`} />
          <div className={`w-2 h-2 rounded-full transition-colors ${step === 'invite' ? 'bg-lol-gold' : 'bg-gray-600'}`} />
        </div>

        {step === 'create' ? (
          <>
            {/* Header */}
            <div className="px-8 pt-6 pb-4 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-lol-gold-light to-lol-gold flex items-center justify-center shadow-lg shadow-lol-gold/20">
                <svg className="w-8 h-8 text-lol-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">Create Your Team</h1>
              <p className="text-gray-400">
                Name your team to start planning drafts with your friends
              </p>
            </div>

            {/* Form */}
            <div className="px-8 py-6">
              <div className="space-y-4">
                <div>
                  <label htmlFor="team-name" className="block text-sm font-medium text-gray-300 mb-2">
                    Team Name
                  </label>
                  <input
                    id="team-name"
                    type="text"
                    value={teamName}
                    onChange={(e) => {
                      setTeamName(e.target.value);
                      setTeamNameError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !isCreating) handleCreateTeam();
                    }}
                    disabled={isCreating}
                    placeholder="e.g. The Rift Raiders"
                    className={`w-full px-4 py-3 bg-lol-dark border rounded-xl text-white placeholder-gray-500 focus:outline-none transition-colors ${
                      teamNameError
                        ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/20'
                        : 'border-lol-border focus:border-lol-gold/50 focus:ring-2 focus:ring-lol-gold/20'
                    } disabled:opacity-60`}
                    autoFocus
                  />
                  {teamNameError && (
                    <div className="flex items-center gap-2 mt-2 text-red-400 text-sm">
                      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>{teamNameError}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-8 pb-8 pt-2">
              <button
                onClick={handleCreateTeam}
                disabled={isCreating || !teamName.trim()}
                className="flex items-center justify-center gap-2 w-full py-3 px-6 bg-gradient-to-r from-lol-gold-light to-lol-gold text-lol-dark font-semibold rounded-xl hover:shadow-lg hover:shadow-lol-gold/20 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isCreating && (
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                )}
                {isCreating ? 'Creating...' : 'Create Team'}
              </button>
              <button
                onClick={handleDismiss}
                className="w-full mt-3 py-2 text-sm text-gray-500 hover:text-gray-300 transition-colors"
              >
                Explore on my own
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Header */}
            <div className="px-8 pt-6 pb-4 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-lol-gold-light to-lol-gold flex items-center justify-center shadow-lg shadow-lol-gold/20">
                <svg className="w-8 h-8 text-lol-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">Invite Your Friends</h1>
              <p className="text-gray-400">
                Add teammates to <span className="text-white font-medium">{teamName}</span>
              </p>
            </div>

            {/* Content */}
            <div className="px-8 py-4 space-y-4 max-h-[50vh] overflow-y-auto">
              {/* Sync warning */}
              {!teamSynced && !testMode && (
                <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-yellow-400 text-sm">
                  Team is syncing... Invites will be available shortly.
                </div>
              )}

              {/* Friends quick-invite */}
              {friends.length > 0 && (teamSynced || testMode) && (
                <div className="space-y-2 p-4 bg-lol-surface rounded-xl border border-lol-border">
                  <h3 className="text-sm font-medium text-gray-300">Invite Friends</h3>
                  <div className="space-y-1.5">
                    {friends.map((friend) => {
                      const isInvited = invitedNames.has(friend.displayName.toLowerCase());
                      const isSending = sendingFriendId === friend.friendId;
                      const disabled = isInvited || isSending || sending;

                      return (
                        <div key={friend.friendId} className="flex items-center gap-3 p-2 rounded-lg hover:bg-lol-card/50 transition-colors">
                          {friend.avatarUrl ? (
                            <img
                              src={friend.avatarUrl}
                              alt={friend.displayName}
                              className="w-8 h-8 rounded-full shrink-0"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-linear-to-br from-lol-gold/20 to-lol-gold/5 flex items-center justify-center shrink-0">
                              <span className="text-lol-gold text-sm font-medium">
                                {friend.displayName.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                          <span className="text-sm text-gray-300 truncate flex-1">{friend.displayName}</span>
                          {isInvited ? (
                            <span className="px-2 py-1 text-xs text-green-400 bg-green-500/10 rounded border border-green-500/20">Invited</span>
                          ) : (
                            <button
                              onClick={() => handleInviteFriend(friend)}
                              disabled={disabled}
                              className="px-3 py-1 text-xs font-medium text-lol-gold bg-lol-gold/10 hover:bg-lol-gold/20 border border-lol-gold/30 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isSending ? (
                                <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                              ) : (
                                'Invite'
                              )}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Invite by username/email */}
              {(teamSynced || testMode) && (
                <div className="space-y-3 p-4 bg-lol-surface rounded-xl border border-lol-border">
                  <h3 className="text-sm font-medium text-gray-300">Invite by Username or Email</h3>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendInvite()}
                      placeholder="Enter username or email"
                      className="flex-1 px-3 py-2 bg-lol-card border border-lol-border rounded-lg text-gray-300 text-sm placeholder:text-gray-600 focus:outline-none focus:border-lol-gold/50"
                    />
                    <button
                      onClick={() => handleSendInvite()}
                      disabled={!identifier.trim() || sending}
                      className="flex items-center gap-2 px-4 py-2 bg-lol-gold/10 hover:bg-lol-gold/20 border border-lol-gold/30 text-lol-gold rounded-lg font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {sending ? (
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                      )}
                      Send
                    </button>
                  </div>
                </div>
              )}

              {/* Invite results */}
              {inviteResults.length > 0 && (
                <div className="space-y-1.5">
                  {inviteResults.map((result, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                        result.success
                          ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                          : 'bg-red-500/10 border border-red-500/20 text-red-400'
                      }`}
                    >
                      {result.success ? (
                        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                      <span className="truncate">
                        {result.success
                          ? `Invite sent to ${result.name}`
                          : result.error || `Could not invite ${result.name}`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-8 pb-8 pt-4">
              <button
                onClick={handleDismiss}
                className="flex items-center justify-center gap-2 w-full py-3 px-6 bg-gradient-to-r from-lol-gold-light to-lol-gold text-lol-dark font-semibold rounded-xl hover:shadow-lg hover:shadow-lol-gold/20 transition-all duration-200"
              >
                Start Planning
              </button>
              {inviteResults.filter((r) => r.success).length === 0 && (
                <button
                  onClick={handleDismiss}
                  className="w-full mt-3 py-2 text-sm text-gray-500 hover:text-gray-300 transition-colors"
                >
                  Skip for now
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function TeamOnboardingModal() {
  const { user, profile } = useAuthStore();
  const { hasCompletedOnboarding, hasCompletedTeamOnboarding } = useSettingsStore();
  const teams = useMyTeamStore((s) => s.teams);

  // Guard: only show for authenticated users who completed general onboarding,
  // have a username, haven't completed team onboarding, and have no teams
  const shouldShow =
    !!user &&
    !!profile?.displayName &&
    hasCompletedOnboarding &&
    !hasCompletedTeamOnboarding &&
    teams.length === 0;

  if (!shouldShow) return null;

  return <TeamOnboardingContent />;
}
