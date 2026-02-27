import { Friend, PendingFriendRequest, BlockedUser, ProfileRole } from '../../types/database';
import { formatDistanceToNow } from '../../lib/dateUtils';

// Role display labels
const ROLE_LABELS: Record<ProfileRole, string> = {
  team_owner: 'Team Owner',
  head_coach: 'Head Coach',
  coach: 'Coach',
  analyst: 'Analyst',
  player: 'Player',
  manager: 'Manager',
  scout: 'Scout',
  content_creator: 'Content Creator',
  caster: 'Caster',
  journalist: 'Journalist',
  streamer: 'Streamer',
  groupie: 'Groupie',
  developer: 'Developer',
};

function getRoleDisplay(
  role?: ProfileRole | null,
  roleTeamName?: string | null
): string | null {
  if (!role) return null;

  const roleLabel = ROLE_LABELS[role] || null;
  if (!roleLabel) return null;

  // Add team name if available
  if (roleTeamName) {
    return `${roleLabel} for ${roleTeamName}`;
  }

  return roleLabel;
}

interface FriendCardProps {
  friend: Friend;
  onRemove: () => void;
  onMessage: () => void;
  onBlock: () => void;
}

export function FriendCard({ friend, onRemove, onMessage, onBlock }: FriendCardProps) {
  const initials = friend.displayName?.slice(0, 2).toUpperCase() || '??';
  const roleDisplay = getRoleDisplay(friend.role, friend.roleTeamName);

  return (
    <div className="flex items-center gap-3 p-3 bg-lol-surface rounded-lg border border-lol-border hover:border-lol-gold/30 transition-colors">
      {friend.avatarUrl ? (
        <img
          src={friend.avatarUrl}
          alt={friend.displayName}
          className="w-10 h-10 rounded-lg object-cover"
        />
      ) : (
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-lol-gold to-lol-gold-light flex items-center justify-center text-lol-dark font-semibold text-sm">
          {initials}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">
          {friend.displayName}
        </p>
        {roleDisplay && (
          <p className="text-[10px] font-medium text-lol-gold truncate">
            {roleDisplay}
          </p>
        )}
        <p className="text-xs text-gray-500">
          Friends since {formatDistanceToNow(friend.acceptedAt)}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onMessage}
          className="p-2 rounded-lg bg-lol-card hover:bg-lol-gold/20 text-gray-400 hover:text-lol-gold transition-colors"
          title="Send message"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </button>

        <button
          onClick={onRemove}
          className="p-2 rounded-lg bg-lol-card hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors"
          title="Remove friend"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6" />
          </svg>
        </button>

        <button
          onClick={onBlock}
          className="p-2 rounded-lg bg-lol-card hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors"
          title="Block user"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        </button>
      </div>
    </div>
  );
}

interface PendingRequestCardProps {
  request: PendingFriendRequest;
  type: 'received' | 'sent';
  onAccept?: () => void;
  onDecline?: () => void;
  onCancel?: () => void;
  onBlock?: () => void;
}

export function PendingRequestCard({
  request,
  type,
  onAccept,
  onDecline,
  onCancel,
  onBlock,
}: PendingRequestCardProps) {
  const initials = request.displayName?.slice(0, 2).toUpperCase() || '??';
  const roleDisplay = getRoleDisplay(request.role, request.roleTeamName);

  return (
    <div className="flex items-center gap-3 p-3 bg-lol-surface rounded-lg border border-lol-border">
      {request.avatarUrl ? (
        <img
          src={request.avatarUrl}
          alt={request.displayName}
          className="w-10 h-10 rounded-lg object-cover"
        />
      ) : (
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-gray-600 to-gray-700 flex items-center justify-center text-white font-semibold text-sm">
          {initials}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">
          {request.displayName}
        </p>
        {roleDisplay && (
          <p className="text-[10px] font-medium text-lol-gold truncate">
            {roleDisplay}
          </p>
        )}
        <p className="text-xs text-gray-500">
          {type === 'received' ? 'Wants to be friends' : 'Request pending'} ·{' '}
          {formatDistanceToNow(request.createdAt)}
        </p>
      </div>

      <div className="flex items-center gap-2">
        {type === 'received' ? (
          <>
            <button
              onClick={onAccept}
              className="px-3 py-1.5 rounded-lg bg-lol-gold/20 hover:bg-lol-gold/30 text-lol-gold text-sm font-medium transition-colors"
            >
              Accept
            </button>
            <button
              onClick={onDecline}
              className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium transition-colors"
            >
              Decline
            </button>
            {onBlock && (
              <button
                onClick={onBlock}
                className="p-2 rounded-lg bg-lol-card hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors"
                title="Block user"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </button>
            )}
          </>
        ) : (
          <button
            onClick={onCancel}
            className="px-3 py-1.5 rounded-lg bg-gray-500/10 hover:bg-gray-500/20 text-gray-400 text-sm font-medium transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

interface BlockedUserCardProps {
  blockedUser: BlockedUser;
  onUnblock: () => void;
}

export function BlockedUserCard({ blockedUser, onUnblock }: BlockedUserCardProps) {
  const initials = blockedUser.displayName?.slice(0, 2).toUpperCase() || '??';

  return (
    <div className="flex items-center gap-3 p-3 bg-lol-surface rounded-lg border border-lol-border">
      {blockedUser.avatarUrl ? (
        <img
          src={blockedUser.avatarUrl}
          alt={blockedUser.displayName}
          className="w-10 h-10 rounded-lg object-cover grayscale opacity-60"
        />
      ) : (
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-gray-600 to-gray-700 flex items-center justify-center text-white font-semibold text-sm opacity-60">
          {initials}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-400 truncate">
          {blockedUser.displayName}
        </p>
        <p className="text-xs text-gray-500">
          Blocked {formatDistanceToNow(blockedUser.blockedAt)}
        </p>
      </div>

      <button
        onClick={onUnblock}
        className="px-3 py-1.5 rounded-lg bg-gray-500/10 hover:bg-gray-500/20 text-gray-400 text-sm font-medium transition-colors"
      >
        Unblock
      </button>
    </div>
  );
}
