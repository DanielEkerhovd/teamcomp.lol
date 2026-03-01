import { useState, useEffect, useRef, useCallback } from "react";
import {
  teamMembershipService,
  TeamMember,
  MemberRole,
} from "../../lib/teamMembershipService";
import { supabase } from "../../lib/supabase";
import { useFriendsStore } from "../../stores/useFriendsStore";
import InviteModal from "./InviteModal";
import TransferOwnershipModal from "./TransferOwnershipModal";
import { ConfirmationModal } from "../ui";
import type { Player } from "../../types";

const ROLE_RANK: Record<MemberRole, number> = {
  owner: 4,
  admin: 3,
  player: 2,
  viewer: 1,
};

interface TeamMembersPanelProps {
  teamId: string;
  teamName: string;
  players: Player[];
  isOwner: boolean;
  currentUserId?: string;
  currentUserRole?: MemberRole;
  isInviteModalOpen?: boolean;
  onInviteModalClose?: () => void;
  onLeaveTeam?: () => void;
}

export default function TeamMembersPanel({
  teamId,
  teamName,
  players,
  isOwner,
  currentUserId,
  currentUserRole = "viewer",
  isInviteModalOpen: externalInviteOpen,
  onInviteModalClose,
  onLeaveTeam,
}: TeamMembersPanelProps) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [internalInviteOpen, setInternalInviteOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<string | null>(null);
  const [transferTarget, setTransferTarget] = useState<TeamMember | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  // Friends state for "Add Friend" button
  const friends = useFriendsStore((s) => s.friends);
  const pendingSent = useFriendsStore((s) => s.pendingSent);
  const sendRequest = useFriendsStore((s) => s.sendRequest);
  const loadFriends = useFriendsStore((s) => s.loadFriends);
  const [sendingFriendTo, setSendingFriendTo] = useState<string | null>(null);

  // Build sets for quick lookup
  const friendUserIds = new Set(friends.map((f) => f.friendId));
  const pendingSentUserIds = new Set(pendingSent.map((p) => p.toUserId));

  // Support both internal and external control of invite modal
  const isInviteModalOpen = externalInviteOpen || internalInviteOpen;
  const closeInviteModal = () => {
    setInternalInviteOpen(false);
    onInviteModalClose?.();
  };

  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadMembers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await teamMembershipService.getTeamMembers(teamId);
      setMembers(result);
      return result;
    } catch (err) {
      setError("Failed to load team members");
      console.error(err);
      return [];
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    if (retryRef.current) {
      clearTimeout(retryRef.current);
      retryRef.current = null;
    }

    loadMembers().then((result) => {
      // Team may not be synced to Supabase yet (cloud sync debounce ~3s).
      // Retry once after sync window if we got no results.
      if (result.length === 0) {
        retryRef.current = setTimeout(() => {
          loadMembers();
          retryRef.current = null;
        }, 3500);
      }
    });
    loadFriends();

    // Subscribe to realtime changes on both team_members AND my_teams.
    // The owner is fetched from my_teams, so we need to reload when that row changes too.
    const sb = supabase;
    if (!sb) return;
    const channel = sb
      .channel(`team-panel-${teamId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "team_members",
          filter: `team_id=eq.${teamId}`,
        },
        () => {
          loadMembers();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "my_teams",
          filter: `id=eq.${teamId}`,
        },
        () => {
          loadMembers();
        },
      )
      .subscribe();

    return () => {
      sb.removeChannel(channel);
      if (retryRef.current) {
        clearTimeout(retryRef.current);
        retryRef.current = null;
      }
    };
  }, [teamId, loadMembers]);

  // Close settings menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    };
    if (settingsOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [settingsOpen]);

  const handleRemoveMember = (memberId: string) => {
    setMemberToRemove(memberId);
  };

  const confirmRemoveMember = async () => {
    if (!memberToRemove) return;
    try {
      const removed = await teamMembershipService.removeMember(memberToRemove);
      setMemberToRemove(null);
      if (!removed) {
        setError("Failed to remove member — you may not have permission");
        return;
      }
      await loadMembers();
    } catch (err) {
      setError("Failed to remove member");
      console.error(err);
    }
  };

  const handleUpdateRole = async (memberId: string, newRole: MemberRole) => {
    try {
      const updated = await teamMembershipService.updateMember(memberId, {
        role: newRole,
      });
      if (!updated) {
        setError("Failed to update role — you may not have permission");
        return;
      }
      await loadMembers();
    } catch (err) {
      setError("Failed to update role");
      console.error(err);
    }
  };

  const handleUpdatePermissions = async (
    memberId: string,
    canEditGroups: boolean,
  ) => {
    try {
      const result = await teamMembershipService.updateMemberPermissions(
        memberId,
        canEditGroups,
      );
      if (!result.success) {
        setError(result.error || "Failed to update permissions");
        return;
      }
      await loadMembers();
    } catch (err) {
      setError("Failed to update permissions");
      console.error(err);
    }
  };

  const handleUpdateSlot = async (
    memberId: string,
    playerSlotId: string | null,
  ) => {
    try {
      // Owner has a synthetic id (owner-<teamId>), update my_teams instead of team_members
      if (memberId.startsWith("owner-")) {
        await teamMembershipService.updateOwnerSlot(teamId, playerSlotId);
      } else {
        const updated = await teamMembershipService.updateMember(memberId, {
          playerSlotId,
        });
        if (!updated) {
          setError(
            "Failed to update player slot — you may not have permission",
          );
          return;
        }
      }
      await loadMembers();
    } catch (err) {
      setError("Failed to update player slot");
      console.error(err);
    }
  };

  const handleTransferOwnership = (member: TeamMember) => {
    setTransferError(null);
    setTransferTarget(member);
  };

  const [transferSuccess, setTransferSuccess] = useState(false);

  const confirmTransferOwnership = async () => {
    if (!transferTarget) return;
    setIsTransferring(true);
    setTransferError(null);
    try {
      const result = await teamMembershipService.requestOwnershipTransfer(
        teamId,
        transferTarget.userId,
      );
      if (!result.success) {
        setTransferError(result.error || "Failed to send transfer request");
        return;
      }
      setTransferTarget(null);
      setTransferSuccess(true);
      setTimeout(() => setTransferSuccess(false), 4000);
    } catch (err) {
      console.error("Error requesting ownership transfer:", err);
      setTransferError("Failed to send transfer request. Please try again.");
    } finally {
      setIsTransferring(false);
    }
  };

  const handleAddFriend = async (userId: string) => {
    setSendingFriendTo(userId);
    try {
      // sendRequest expects a display name or email, but we can look up the member
      const member = members.find((m) => m.userId === userId);
      if (member?.user?.displayName) {
        await sendRequest(member.user.displayName);
      }
    } catch (err) {
      console.error("Failed to send friend request:", err);
    } finally {
      setSendingFriendTo(null);
    }
  };

  const getFriendStatus = (userId: string): "friend" | "pending" | "none" => {
    if (friendUserIds.has(userId)) return "friend";
    if (pendingSentUserIds.has(userId)) return "pending";
    return "none";
  };

  const getRoleBadgeClass = (role: MemberRole): string => {
    switch (role) {
      case "owner":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "admin":
        return "bg-purple-500/20 text-purple-400 border-purple-500/30";
      case "player":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      case "viewer":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      default:
        return "bg-gray-500/20 text-gray-400 border-gray-500/30";
    }
  };

  // Get all players with a name for assignment (including subs)
  const assignablePlayers = players.filter((p) => p.summonerName);

  // Can the current user manage members?
  const canManage = isOwner || currentUserRole === "admin";

  // Can the current user change this member's role?
  // Owner can change anyone except themselves. Admins can only change strictly lower ranks (player/viewer).
  const canChangeRole = (memberRole: MemberRole): boolean => {
    if (isOwner) return memberRole !== "owner";
    if (currentUserRole === "admin")
      return ROLE_RANK[currentUserRole] > ROLE_RANK[memberRole];
    return false;
  };

  // Can the current user remove this member? (admins can only remove strictly lower ranks)
  const canRemoveMember = (memberRole: MemberRole): boolean => {
    if (memberRole === "owner") return false;
    if (isOwner) return true;
    if (currentUserRole === "admin")
      return ROLE_RANK[currentUserRole] > ROLE_RANK[memberRole];
    return false;
  };

  // Separate owner from other members
  const owner = members.find((m) => m.role === "owner");
  const otherMembers = members.filter((m) => m.role !== "owner");

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <svg
            className="w-5 h-5 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
          Team Members
          <span className="text-sm font-normal text-gray-500">
            ({members.length})
          </span>
        </h3>
        <div className="flex items-center gap-2">
          {canManage && (
            <button
              onClick={() => setInternalInviteOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-lol-gold/10 hover:bg-lol-gold/20 border border-lol-gold/30 text-lol-gold rounded-lg text-sm font-medium transition-colors"
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
                  d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                />
              </svg>
              Invite
            </button>
          )}
          {isOwner && (
            <div className="relative" ref={settingsRef}>
              <button
                onClick={() => setSettingsOpen(!settingsOpen)}
                className="p-1.5 text-gray-500 hover:text-gray-300 hover:bg-lol-surface rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
              {settingsOpen && (
                <div className="absolute right-0 top-full mt-1 w-52 bg-lol-card border border-lol-border rounded-lg shadow-xl z-50 overflow-hidden">
                  <button
                    onClick={() => {
                      setSettingsOpen(false);
                      setIsTransferModalOpen(true);
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-yellow-400 hover:bg-yellow-500/10 flex items-center gap-2 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                    Transfer Ownership
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

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

      {/* Members grid */}
      {!loading && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Owner (always first) */}
            {owner && (
              <MemberCard
                member={owner}
                players={players}
                assignablePlayers={assignablePlayers}
                canEdit={canChangeRole("owner")}
                canRemove={false}
                canAssignSlot={isOwner || currentUserRole === "admin"}
                isSelf={owner.userId === currentUserId}
                isCurrentUserOwner={isOwner}
                friendStatus={getFriendStatus(owner.userId)}
                sendingFriend={sendingFriendTo === owner.userId}
                getRoleBadgeClass={getRoleBadgeClass}
                onRemove={handleRemoveMember}
                onLeave={() => onLeaveTeam?.()}
                onTransferOwnership={handleTransferOwnership}
                onUpdateRole={handleUpdateRole}
                onUpdateSlot={handleUpdateSlot}
                onUpdatePermissions={handleUpdatePermissions}
                onAddFriend={handleAddFriend}
              />
            )}

            {/* Other members */}
            {otherMembers.map((member) => (
              <MemberCard
                key={member.id}
                member={member}
                players={players}
                assignablePlayers={assignablePlayers}
                canEdit={canChangeRole(member.role)}
                canRemove={canRemoveMember(member.role)}
                canAssignSlot={canManage && member.role !== "owner"}
                isSelf={member.userId === currentUserId}
                isCurrentUserOwner={isOwner}
                friendStatus={getFriendStatus(member.userId)}
                sendingFriend={sendingFriendTo === member.userId}
                getRoleBadgeClass={getRoleBadgeClass}
                onRemove={handleRemoveMember}
                onLeave={() => onLeaveTeam?.()}
                onTransferOwnership={handleTransferOwnership}
                onUpdateRole={handleUpdateRole}
                onUpdateSlot={handleUpdateSlot}
                onUpdatePermissions={handleUpdatePermissions}
                onAddFriend={handleAddFriend}
              />
            ))}
            {/* Only owner — inline hint */}
            {members.length === 1 && owner && (
              <div className="flex items-center justify-center p-3 text-gray-500 text-sm">
                {isOwner
                  ? "You're the only member. Invite teammates to collaborate!"
                  : "No other members yet."}
              </div>
            )}
          </div>

          {/* Empty state */}
          {members.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <svg
                className="w-12 h-12 mx-auto mb-2 opacity-50"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              <p>No team members yet</p>
              {canManage && (
                <p className="text-sm mt-1">
                  Invite teammates to collaborate on this team
                </p>
              )}
            </div>
          )}

        </>
      )}

      {/* Invite Modal */}
      <InviteModal
        isOpen={isInviteModalOpen}
        onClose={closeInviteModal}
        teamId={teamId}
        teamName={teamName}
        players={players}
      />

      {/* Transfer Ownership Modal */}
      <TransferOwnershipModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        teamId={teamId}
        teamName={teamName}
        onTransferRequested={() => {
          setIsTransferModalOpen(false);
          setTransferSuccess(true);
          setTimeout(() => setTransferSuccess(false), 4000);
        }}
      />

      {/* Remove Member Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!memberToRemove}
        onClose={() => setMemberToRemove(null)}
        onConfirm={confirmRemoveMember}
        title="Remove Member"
        message="Are you sure you want to remove this member from the team?"
        confirmText="Remove"
      />

      {/* Transfer request sent success message */}
      {transferSuccess && (
        <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm flex items-center gap-2">
          <svg
            className="w-4 h-4 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
          Transfer request sent! They will need to accept before the transfer
          takes effect.
        </div>
      )}

      {/* Transfer Ownership Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!transferTarget}
        onClose={() => {
          if (!isTransferring) {
            setTransferTarget(null);
            setTransferError(null);
          }
        }}
        onConfirm={confirmTransferOwnership}
        title="Transfer Ownership"
        message={`This will send a transfer request to ${transferTarget?.user?.displayName || "this member"} for ownership of "${teamName}". They will need to accept before the transfer takes effect.\n\nIf you have an active subscription tied to this team, make sure to update the payment owner before transferring.`}
        confirmText="Send Request"
        variant="warning"
        size="md"
        isLoading={isTransferring}
        error={transferError}
      />
    </div>
  );
}

interface MemberCardProps {
  member: TeamMember;
  players: Player[];
  assignablePlayers: Player[];
  canEdit: boolean;
  canRemove: boolean;
  canAssignSlot: boolean;
  isSelf: boolean;
  isCurrentUserOwner: boolean;
  friendStatus: "friend" | "pending" | "none";
  sendingFriend: boolean;
  getRoleBadgeClass: (role: MemberRole) => string;
  onRemove: (memberId: string) => void;
  onLeave: () => void;
  onTransferOwnership: (member: TeamMember) => void;
  onUpdateRole: (memberId: string, role: MemberRole) => void;
  onUpdateSlot: (memberId: string, playerSlotId: string | null) => void;
  onUpdatePermissions: (memberId: string, canEditGroups: boolean) => void;
  onAddFriend: (userId: string) => void;
}

const selectClass =
  "w-full px-2 py-1.5 bg-lol-dark/80 border border-lol-border rounded-md text-xs text-gray-200 appearance-none cursor-pointer hover:border-gray-500 focus:outline-none focus:border-lol-gold/60 focus:ring-1 focus:ring-lol-gold/20 transition-colors";

function MemberCard({
  member,
  players,
  assignablePlayers,
  canEdit,
  canRemove,
  canAssignSlot,
  isSelf,
  isCurrentUserOwner,
  friendStatus,
  sendingFriend,
  getRoleBadgeClass,
  onRemove,
  onLeave,
  onTransferOwnership,
  onUpdateRole,
  onUpdateSlot,
  onUpdatePermissions,
  onAddFriend,
}: MemberCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [rolePopoverOpen, setRolePopoverOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const rolePopoverRef = useRef<HTMLDivElement>(null);
  const assignedPlayer = member.playerSlotId
    ? players.find((p) => p.id === member.playerSlotId)
    : null;
  const displayName =
    member.user?.displayName || member.user?.email || "Unknown User";

  // Group assignable players: mains first, then subs
  const mains = assignablePlayers.filter((p) => !p.isSub);
  const subs = assignablePlayers.filter((p) => p.isSub);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
      if (
        rolePopoverRef.current &&
        !rolePopoverRef.current.contains(e.target as Node)
      ) {
        setRolePopoverOpen(false);
      }
    };
    if (menuOpen || rolePopoverOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [menuOpen, rolePopoverOpen]);

  // Show kebab menu if user can remove this member, it's their own card (leave), or owner can transfer
  const canTransfer = isCurrentUserOwner && !isSelf && member.role !== "owner";
  const showMenu =
    canRemove || canTransfer || canEdit || (isSelf && !isCurrentUserOwner);

  return (
    <div className="p-3 bg-lol-surface rounded-lg border border-lol-border flex flex-col gap-2.5">
      {/* Top row: avatar + name + role badge + kebab menu */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 shrink-0 rounded-full bg-lol-card flex items-center justify-center overflow-hidden">
          {member.user?.avatarUrl ? (
            <img
              src={member.user.avatarUrl}
              alt=""
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <svg
              className="w-4 h-4 text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-white font-medium truncate">
              {displayName}
            </span>
            {isSelf && <span className="text-[10px] text-gray-500">(you)</span>}
            <div className="relative shrink-0" ref={rolePopoverRef}>
              <button
                onClick={() => canEdit && setRolePopoverOpen(!rolePopoverOpen)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase border ${getRoleBadgeClass(member.role)} ${canEdit ? "cursor-pointer hover:brightness-125 transition-all" : "cursor-default"}`}
              >
                {member.role}
              </button>
              {rolePopoverOpen && canEdit && (
                <div className="absolute left-0 bottom-full mb-1 w-48 bg-lol-card border border-lol-border rounded-lg shadow-xl z-50 overflow-hidden">
                  <div className="px-3 py-2 border-b border-lol-border/50">
                    <span className="text-[11px] text-gray-500 uppercase tracking-wider font-medium">
                      Role
                    </span>
                  </div>
                  {(["admin", "player", "viewer"] as MemberRole[]).map(
                    (role) => (
                      <button
                        key={role}
                        onClick={() => {
                          if (role !== member.role) {
                            onUpdateRole(member.id, role);
                            if (role === "viewer") {
                              onUpdateSlot(member.id, null);
                            }
                          }
                          setRolePopoverOpen(false);
                        }}
                        className={`w-full px-3 py-1.5 text-left text-sm flex items-center gap-2 transition-colors ${
                          role === member.role
                            ? "bg-white/5 text-white"
                            : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${role === member.role ? "bg-lol-gold" : "bg-gray-600"}`}
                        />
                        <span className="capitalize">{role}</span>
                      </button>
                    ),
                  )}
                  {member.role !== "owner" && (
                    <>
                      <div className="px-3 py-2 mt-1 border-t border-lol-border/50">
                        <span className="text-[11px] text-gray-500 uppercase tracking-wider font-medium">
                          Permissions
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          onUpdatePermissions(member.id, !member.canEditGroups);
                          setRolePopoverOpen(false);
                        }}
                        className="w-full px-3 py-1.5 text-left text-sm flex items-center gap-2 text-gray-400 hover:bg-white/5 hover:text-gray-200 transition-colors"
                      >
                        <span
                          className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${
                            member.canEditGroups
                              ? "bg-lol-gold/20 border-lol-gold/50 text-lol-gold"
                              : "border-gray-600"
                          }`}
                        >
                          {member.canEditGroups && (
                            <svg
                              className="w-2.5 h-2.5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={3}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          )}
                        </span>
                        Can edit groups
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
          {member.user?.email && member.user.displayName && (
            <div className="text-[11px] text-gray-600 truncate">
              {member.user.email}
            </div>
          )}
        </div>
        {/* Add Friend / friend status - top right of card for non-self members */}
        {!isSelf && friendStatus === "none" && (
          <button
            onClick={() => onAddFriend(member.userId)}
            disabled={sendingFriend}
            className="shrink-0 flex items-center gap-1 text-[11px] text-lol-gold/70 hover:text-lol-gold transition-colors disabled:opacity-50"
          >
            <svg
              className="w-3 h-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
              />
            </svg>
            {sendingFriend ? "Sending..." : "Add Friend"}
          </button>
        )}
        {!isSelf && friendStatus === "pending" && (
          <span className="shrink-0 text-[11px] text-yellow-500/70">
            Request sent
          </span>
        )}
        {!isSelf && friendStatus === "friend" && (
          <span className="shrink-0 text-[11px] text-green-500/70">
            Friends
          </span>
        )}
        {/* Kebab menu */}
        {showMenu && (
          <div className="relative shrink-0" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-1 text-gray-500 hover:text-gray-300 rounded transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
              </svg>
            </button>
            {menuOpen && (
              <div className="absolute right-0 bottom-full mb-1 w-48 bg-lol-card border border-lol-border rounded-lg shadow-xl z-50 overflow-hidden">
                {canEdit && (
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      setRolePopoverOpen(true);
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-white/5 flex items-center gap-2 transition-colors"
                  >
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                    Edit Role
                  </button>
                )}
                {isSelf && !isCurrentUserOwner && (
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onLeave();
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2 transition-colors"
                  >
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                      />
                    </svg>
                    Leave Team
                  </button>
                )}
                {canRemove && !isSelf && (
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onRemove(member.id);
                    }}
                    className="w-full px-3 py-2 mb-1 text-left text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2 transition-colors"
                  >
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                    Remove Member
                  </button>
                )}
                <div className="border-t border-lol-border/50" />
                {canTransfer && (
                  <>
                    <div className="" />
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        onTransferOwnership(member);
                      }}
                      className="w-full px-3 py-2 text-left text-sm text-yellow-400 hover:bg-yellow-500/10 flex items-center gap-2 transition-colors"
                    >
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                        />
                      </svg>
                      Transfer Ownership
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Player slot assignment */}
      {(member.role === "player" ||
        member.role === "admin" ||
        member.role === "owner") && (
        <div className="space-y-1">
          <label className="text-[11px] text-gray-500 uppercase tracking-wider font-medium">
            Assigned Player
          </label>
          {canAssignSlot ? (
            <div className="relative">
              <select
                value={member.playerSlotId || ""}
                onChange={(e) =>
                  onUpdateSlot(member.id, e.target.value || null)
                }
                className={selectClass}
              >
                <option value="">No player assigned</option>
                {mains.length > 0 && (
                  <optgroup label="Main Roster">
                    {mains.map((player) => (
                      <option key={player.id} value={player.id}>
                        {player.summonerName} ({player.role.toUpperCase()})
                      </option>
                    ))}
                  </optgroup>
                )}
                {subs.length > 0 && (
                  <optgroup label="Substitutes">
                    {subs.map((player) => (
                      <option key={player.id} value={player.id}>
                        {player.summonerName} ({player.role.toUpperCase()})
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
              <svg
                className="w-3 h-3 text-gray-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>
          ) : (
            <div
              className={`px-2 py-1.5 rounded-md text-xs ${assignedPlayer ? "text-gray-300 bg-lol-dark/40" : "text-gray-600 bg-lol-dark/20"}`}
            >
              {assignedPlayer
                ? `${assignedPlayer.summonerName} (${assignedPlayer.role.toUpperCase()})${assignedPlayer.isSub ? " · Sub" : ""}`
                : "Unassigned"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
