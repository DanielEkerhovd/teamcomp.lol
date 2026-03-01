import { useState, useEffect } from "react";
import Modal from "../ui/Modal";
import Select from "../ui/Select";
import {
  teamMembershipService,
  SentTeamInvite,
} from "../../lib/teamMembershipService";
import { useFriendsStore } from "../../stores/useFriendsStore";
import type { Friend } from "../../types/database";
import type { Player } from "../../types";

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamId: string;
  teamName: string;
  players: Player[];
}

export default function InviteModal({
  isOpen,
  onClose,
  teamId,
  teamName,
  players,
}: InviteModalProps) {
  const [invites, setInvites] = useState<SentTeamInvite[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Invite form state
  const [newRole, setNewRole] = useState<"admin" | "player" | "viewer">(
    "player",
  );
  const [newPlayerSlotId, setNewPlayerSlotId] = useState<string>("");
  const [newCanEditGroups, setNewCanEditGroups] = useState(false);

  // Direct invite state
  const [identifier, setIdentifier] = useState("");
  const [sending, setSending] = useState(false);
  const [sendingFriendId, setSendingFriendId] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Friends state
  const friends = useFriendsStore((s) => s.friends);
  const loadFriends = useFriendsStore((s) => s.loadFriends);
  const [teamMemberUserIds, setTeamMemberUserIds] = useState<Set<string>>(
    new Set(),
  );
  const [friendSearch, setFriendSearch] = useState("");

  // Load existing invites, friends, and team members when modal opens
  useEffect(() => {
    if (isOpen) {
      loadInvites();
      loadFriends();
      teamMembershipService.getTeamMembers(teamId).then((members) => {
        setTeamMemberUserIds(new Set(members.map((m) => m.userId)));
      });
    }
  }, [isOpen, teamId]);

  const loadInvites = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await teamMembershipService.getSentTeamInvites(teamId);
      // Only show direct invites (not link-based)
      setInvites(result.filter((i) => i.isDirectInvite));
    } catch (err) {
      setError("Couldn't load invites. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendInvite = async () => {
    if (!identifier.trim() || sending) return;

    setSending(true);
    setError(null);
    setSuccess(null);

    const result = await teamMembershipService.sendTeamInvite(
      teamId,
      identifier.trim(),
      newRole,
      {
        playerSlotId: newPlayerSlotId || undefined,
        canEditGroups: newCanEditGroups,
      },
    );

    if (result.success) {
      setSuccess(
        `Invite sent to ${result.targetUser?.displayName || identifier}`,
      );
      setIdentifier("");
      loadInvites();
      setTimeout(() => setSuccess(null), 3000);
    } else {
      setError(result.error || "Couldn't send invite. Please try again.");
    }

    setSending(false);
  };

  const handleRevoke = async (inviteId: string) => {
    try {
      const result = await teamMembershipService.cancelTeamInvite(inviteId);
      if (result.success) {
        setInvites(invites.filter((i) => i.inviteId !== inviteId));
      } else {
        setError(result.error || "Couldn't cancel invite. Please try again.");
      }
    } catch (err) {
      setError("Couldn't cancel invite. Please try again.");
      console.error(err);
    }
  };

  const handleInviteFriend = async (friend: Friend) => {
    if (sending || sendingFriendId) return;
    setSendingFriendId(friend.friendId);
    setError(null);
    setSuccess(null);

    const result = await teamMembershipService.sendTeamInvite(
      teamId,
      friend.displayName,
      newRole,
      {
        playerSlotId: newPlayerSlotId || undefined,
        canEditGroups: newCanEditGroups,
      },
    );

    if (result.success) {
      setSuccess(
        `Invite sent to ${result.targetUser?.displayName || friend.displayName}`,
      );
      loadInvites();
      setTimeout(() => setSuccess(null), 3000);
    } else {
      setError(result.error || "Couldn't send invite. Please try again.");
    }

    setSendingFriendId(null);
  };

  // Derive which friends are already invited
  const invitedUserIds = new Set(
    invites.map((i) => i.invitedUser?.id).filter(Boolean),
  );

  // Get main players (not subs) for assignment
  const mainPlayers = players.filter((p) => !p.isSub && p.summonerName);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Invite Team Members"
      size="md"
    >
      <div className="space-y-4">
        {/* Header info */}
        <p className="text-gray-400 text-sm">
          Invite people to join{" "}
          <span className="text-white font-medium">{teamName}</span>. They must
          have an account to receive the invitation.
        </p>

        {/* Error message */}
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Success message */}
        {success && (
          <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm">
            {success}
          </div>
        )}

        {/* Role & permissions selection (top) */}
        <div className="space-y-3 p-4 bg-lol-surface rounded-xl border border-lol-border">
          <h3 className="text-sm font-medium text-gray-300">
            Role & Permissions
          </h3>

          {/* Role selection */}
          <div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setNewRole("admin");
                  setNewPlayerSlotId("");
                  setNewCanEditGroups(true);
                }}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  newRole === "admin"
                    ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                    : "bg-lol-card hover:bg-lol-border text-gray-400 border border-lol-border"
                }`}
              >
                Admin
              </button>
              <button
                onClick={() => setNewRole("player")}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  newRole === "player"
                    ? "bg-green-500/20 text-green-400 border border-green-500/30"
                    : "bg-lol-card hover:bg-lol-border text-gray-400 border border-lol-border"
                }`}
              >
                Player
              </button>
              <button
                onClick={() => {
                  setNewRole("viewer");
                  setNewPlayerSlotId("");
                  setNewCanEditGroups(false);
                }}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  newRole === "viewer"
                    ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                    : "bg-lol-card hover:bg-lol-border text-gray-400 border border-lol-border"
                }`}
              >
                Viewer
              </button>
            </div>
            <p className="text-xs text-gray-600 mt-1">
              {newRole === "admin" &&
                "Can manage team members and edit all players"}
              {newRole === "player" &&
                "Can view team and edit assigned player slot"}
              {newRole === "viewer" && "Can only view team data"}
            </p>
          </div>

          {/* Player slot assignment (only for players) */}
          {newRole === "player" && mainPlayers.length > 0 && (
            <Select
              label="Assign to Player Slot (optional)"
              value={newPlayerSlotId}
              onChange={(e) => setNewPlayerSlotId(e.target.value)}
              options={[
                { value: "", label: "No specific slot" },
                ...mainPlayers.map((player) => ({
                  value: player.id,
                  label: `${player.summonerName} (${player.role.toUpperCase()})`,
                })),
              ]}
              size="sm"
            />
          )}

          {/* Can edit groups toggle (only for players) */}
          {newRole === "player" && (
            <label className="flex items-center justify-between gap-3 p-3 bg-lol-card rounded-lg border border-lol-border cursor-pointer hover:border-lol-gold/30 transition-colors">
              <div>
                <span className="text-sm text-gray-300">Can edit groups</span>
                <p className="text-xs text-gray-500">
                  Players can update champion pools and groups themselves
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={newCanEditGroups}
                onClick={() => setNewCanEditGroups(!newCanEditGroups)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-lol-gold/50 focus:ring-offset-2 focus:ring-offset-lol-dark ${
                  newCanEditGroups ? "bg-lol-gold" : "bg-lol-surface"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    newCanEditGroups ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </label>
          )}
        </div>

        {/* Friends quick-invite section */}
        {friends.length > 0 &&
          (() => {
            const filteredFriends = friendSearch
              ? friends.filter((f) =>
                  f.displayName
                    .toLowerCase()
                    .includes(friendSearch.toLowerCase()),
                )
              : friends;

            return (
              <div className="space-y-2 p-4 bg-lol-surface rounded-xl border border-lol-border">
                <h3 className="text-sm font-medium text-gray-300">
                  Invite Friends
                </h3>

                {/* Search bar (only when more than 3 friends) */}
                {friends.length > 3 && (
                  <div className="relative">
                    <svg
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                    <input
                      type="text"
                      value={friendSearch}
                      onChange={(e) => setFriendSearch(e.target.value)}
                      placeholder="Search friends..."
                      className="w-full pl-8 pr-3 py-1.5 bg-lol-card border border-lol-border rounded-lg text-gray-300 text-sm placeholder:text-gray-600 focus:outline-none focus:border-lol-gold/50"
                    />
                  </div>
                )}

                <div
                  className={`${friends.length > 3 ? "max-h-33 overflow-y-auto" : ""} space-y-1.5 scrollbar-thin`}
                >
                  {filteredFriends.length === 0 ? (
                    <p className="text-xs text-gray-500 text-center py-2">
                      No friends found
                    </p>
                  ) : (
                    filteredFriends.map((friend) => {
                      const isMember = teamMemberUserIds.has(friend.friendId);
                      const isInvited = invitedUserIds.has(friend.friendId);
                      const isSending = sendingFriendId === friend.friendId;
                      const disabled =
                        isMember || isInvited || isSending || sending;

                      return (
                        <div
                          key={friend.friendId}
                          className="flex items-center gap-3 p-2 rounded-lg hover:bg-lol-card/50 transition-colors"
                        >
                          {/* Avatar */}
                          {friend.avatarUrl ? (
                            <img
                              src={friend.avatarUrl}
                              alt={friend.displayName}
                              className="w-8 h-8 rounded-full shrink-0 object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-linear-to-br from-lol-gold/20 to-lol-gold/5 flex items-center justify-center shrink-0">
                              <span className="text-lol-gold text-sm font-medium">
                                {friend.displayName.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}

                          <span className="text-sm text-gray-300 truncate flex-1">
                            {friend.displayName}
                          </span>

                          {isMember ? (
                            <span className="px-2 py-1 text-xs text-gray-500 bg-lol-card rounded border border-lol-border">
                              Member
                            </span>
                          ) : isInvited ? (
                            <span className="px-2 py-1 text-xs text-yellow-500/70 bg-yellow-500/10 rounded border border-yellow-500/20">
                              Invited
                            </span>
                          ) : (
                            <button
                              onClick={() => handleInviteFriend(friend)}
                              disabled={disabled}
                              className="px-3 py-1 text-xs font-medium text-lol-gold bg-lol-gold/10 hover:bg-lol-gold/20 border border-lol-gold/30 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isSending ? (
                                <svg
                                  className="animate-spin h-3 w-3"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                >
                                  <circle
                                    className="opacity-25"
                                    cx="12"
                                    cy="12"
                                    r="10"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                  />
                                  <path
                                    className="opacity-75"
                                    fill="currentColor"
                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                  />
                                </svg>
                              ) : (
                                "Invite"
                              )}
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })()}

        {/* Invite by username/email */}
        <div className="space-y-3 p-4 bg-lol-surface rounded-xl border border-lol-border">
          <h3 className="text-sm font-medium text-gray-300">
            Invite by Username or Email
          </h3>

          <div className="flex gap-2">
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendInvite()}
              placeholder="Enter username or email"
              className="flex-1 px-3 py-2 bg-lol-card border border-lol-border rounded-lg text-gray-300 text-sm placeholder:text-gray-600 focus:outline-none focus:border-lol-gold/50"
            />
            <button
              onClick={handleSendInvite}
              disabled={!identifier.trim() || sending}
              className="flex items-center gap-2 px-4 py-2 bg-lol-gold/10 hover:bg-lol-gold/20 border border-lol-gold/30 text-lol-gold rounded-lg font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? (
                <svg
                  className="animate-spin h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              ) : (
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                  />
                </svg>
              )}
              Send
            </button>
          </div>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-8">
            <svg
              className="animate-spin h-6 w-6 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
        )}

        {/* Pending invites */}
        {!loading && invites.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-400">
              Pending Invites
            </h3>
            {invites.map((invite) => (
              <PendingInviteItem
                key={invite.inviteId}
                invite={invite}
                players={players}
                onRevoke={handleRevoke}
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && invites.length === 0 && (
          <div className="text-center py-4 text-gray-500 text-sm">
            No pending invites
          </div>
        )}
      </div>
    </Modal>
  );
}

interface PendingInviteItemProps {
  invite: SentTeamInvite;
  players: Player[];
  onRevoke: (id: string) => void;
}

function PendingInviteItem({
  invite,
  players,
  onRevoke,
}: PendingInviteItemProps) {
  const assignedPlayer = invite.playerSlotId
    ? players.find((p) => p.id === invite.playerSlotId)
    : null;
  const expiresIn = Math.ceil(
    (new Date(invite.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );

  return (
    <div className="flex items-center gap-3 p-3 bg-lol-surface rounded-lg border border-lol-border">
      {/* Avatar */}
      {invite.invitedUser?.avatarUrl ? (
        <img
          src={invite.invitedUser.avatarUrl}
          alt={invite.invitedUser.displayName}
          className="w-10 h-10 rounded-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-lol-gold/20 to-lol-gold/5 flex items-center justify-center">
          <span className="text-lol-gold font-medium">
            {invite.invitedUser?.displayName?.charAt(0).toUpperCase() || "?"}
          </span>
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-gray-200 font-medium truncate">
            {invite.invitedUser?.displayName || "Unknown"}
          </span>
          <span
            className={`px-2 py-0.5 rounded text-xs font-medium ${
              invite.role === "admin"
                ? "bg-purple-500/20 text-purple-400"
                : invite.role === "player"
                  ? "bg-green-500/20 text-green-400"
                  : "bg-blue-500/20 text-blue-400"
            }`}
          >
            {invite.role}
          </span>
          {invite.canEditGroups && invite.role === "player" && (
            <span className="text-xs text-gray-500">+ groups</span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          {assignedPlayer && <span>Slot: {assignedPlayer.summonerName}</span>}
          <span>
            Expires in {expiresIn} day{expiresIn !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      <button
        onClick={() => onRevoke(invite.inviteId)}
        className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
        title="Cancel invite"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
}
