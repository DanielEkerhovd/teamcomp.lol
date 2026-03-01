import { useState, useEffect, useRef } from "react";
import Modal from "../ui/Modal";
import { teamMembershipService } from "../../lib/teamMembershipService";
import { friendService } from "../../lib/friendService";
import { useFriendsStore } from "../../stores/useFriendsStore";
import { useAuthStore } from "../../stores/useAuthStore";

interface TransferOwnershipModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamId: string;
  teamName: string;
  onTransferRequested: () => void;
}

interface UserResult {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

export default function TransferOwnershipModal({
  isOpen,
  onClose,
  teamId,
  teamName,
  onTransferRequested,
}: TransferOwnershipModalProps) {
  const currentUserId = useAuthStore((s) => s.user?.id);
  const friends = useFriendsStore((s) => s.friends);
  const loadFriends = useFriendsStore((s) => s.loadFriends);

  const [friendSearch, setFriendSearch] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserResult | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadFriends();
      setSelectedUser(null);
      setSearchQuery("");
      setSearchResults([]);
      setFriendSearch("");
      setError(null);
      setSuccess(null);
    }
  }, [isOpen]);

  // Debounced user search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      const results = await friendService.searchUsers(searchQuery.trim());
      // Filter out current user
      setSearchResults(
        results.filter((u) => u.id !== currentUserId),
      );
      setSearching(false);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery, currentUserId]);

  const handleSelectUser = (user: UserResult) => {
    setSelectedUser(user);
    setError(null);
  };

  const handleConfirmTransfer = async () => {
    if (!selectedUser || sending) return;
    setSending(true);
    setError(null);

    try {
      const result = await teamMembershipService.requestOwnershipTransfer(
        teamId,
        selectedUser.id,
      );
      if (result.success) {
        setSuccess(
          `Transfer request sent to ${selectedUser.displayName}! They will need to accept before the transfer takes effect.`,
        );
        setTimeout(() => {
          onTransferRequested();
        }, 1500);
      } else {
        setError(result.error || "Failed to send transfer request");
      }
    } catch (err) {
      console.error("Error requesting ownership transfer:", err);
      setError("Failed to send transfer request. Please try again.");
    } finally {
      setSending(false);
    }
  };

  // Filter friends by search, exclude self
  const filteredFriends = friends
    .filter((f) => f.friendId !== currentUserId)
    .filter(
      (f) =>
        !friendSearch ||
        f.displayName.toLowerCase().includes(friendSearch.toLowerCase()),
    );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Transfer Ownership"
      size="md"
    >
      <div className="space-y-4">
        {/* Info text */}
        <p className="text-gray-400 text-sm">
          Transfer ownership of{" "}
          <span className="text-white font-medium">{teamName}</span> to another
          user. They don't need to be a current team member.
        </p>

        {/* Warning */}
        <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-yellow-400 text-sm flex items-start gap-2">
          <svg
            className="w-4 h-4 shrink-0 mt-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
          <span>
            After transfer, you will become an admin of the team. If you have an
            active subscription tied to this team, update the payment owner
            first.
          </span>
        </div>

        {/* Error message */}
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Success message */}
        {success && (
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
            {success}
          </div>
        )}

        {/* Confirmation step */}
        {selectedUser && !success ? (
          <div className="space-y-4 p-4 bg-lol-surface rounded-xl border border-lol-border">
            <h3 className="text-sm font-medium text-gray-300">
              Confirm Transfer
            </h3>
            <div className="flex items-center gap-3">
              {selectedUser.avatarUrl ? (
                <img
                  src={selectedUser.avatarUrl}
                  alt=""
                  className="w-10 h-10 rounded-full shrink-0 object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-linear-to-br from-lol-gold/20 to-lol-gold/5 flex items-center justify-center shrink-0">
                  <span className="text-lol-gold font-medium">
                    {selectedUser.displayName.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <span className="text-sm text-white font-medium truncate block">
                  {selectedUser.displayName}
                </span>
                <span className="text-xs text-gray-500">
                  Will become the new owner
                </span>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                disabled={sending}
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-50"
              >
                Change
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedUser(null)}
                disabled={sending}
                className="flex-1 px-4 py-2 bg-lol-surface hover:bg-lol-border border border-lol-border text-gray-400 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmTransfer}
                disabled={sending}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/40 text-yellow-400 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
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
                  "Send Transfer Request"
                )}
              </button>
            </div>
          </div>
        ) : !success ? (
          <>
            {/* Friends quick-select */}
            {friends.length > 0 && (
              <div className="space-y-2 p-4 bg-lol-surface rounded-xl border border-lol-border">
                <h3 className="text-sm font-medium text-gray-300">
                  Select from Friends
                </h3>

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
                    filteredFriends.map((friend) => (
                      <UserRow
                        key={friend.friendId}
                        user={{
                          id: friend.friendId,
                          displayName: friend.displayName,
                          avatarUrl: friend.avatarUrl,
                        }}
                        onSelect={() =>
                          handleSelectUser({
                            id: friend.friendId,
                            displayName: friend.displayName,
                            avatarUrl: friend.avatarUrl,
                          })
                        }
                      />
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Search by username/email */}
            <div className="space-y-3 p-4 bg-lol-surface rounded-xl border border-lol-border">
              <h3 className="text-sm font-medium text-gray-300">
                Search by Username or Email
              </h3>

              <div className="relative">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"
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
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Type at least 2 characters to search..."
                  className="w-full pl-9 pr-3 py-2 bg-lol-card border border-lol-border rounded-lg text-gray-300 text-sm placeholder:text-gray-600 focus:outline-none focus:border-lol-gold/50"
                />
              </div>

              {/* Search results */}
              {searching && (
                <div className="flex items-center justify-center py-4">
                  <svg
                    className="animate-spin h-5 w-5 text-gray-400"
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

              {!searching && searchQuery.trim().length >= 2 && (
                <div className="space-y-1.5 max-h-40 overflow-y-auto scrollbar-thin">
                  {searchResults.length === 0 ? (
                    <p className="text-xs text-gray-500 text-center py-2">
                      No users found
                    </p>
                  ) : (
                    searchResults.map((user) => (
                      <UserRow
                        key={user.id}
                        user={user}
                        onSelect={() => handleSelectUser(user)}
                      />
                    ))
                  )}
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </Modal>
  );
}

function UserRow({
  user,
  onSelect,
}: {
  user: UserResult;
  onSelect: () => void;
}) {
  return (
    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-lol-card/50 transition-colors">
      {user.avatarUrl ? (
        <img
          src={user.avatarUrl}
          alt=""
          className="w-8 h-8 rounded-full shrink-0 object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-linear-to-br from-lol-gold/20 to-lol-gold/5 flex items-center justify-center shrink-0">
          <span className="text-lol-gold text-sm font-medium">
            {user.displayName.charAt(0).toUpperCase()}
          </span>
        </div>
      )}
      <span className="text-sm text-gray-300 truncate flex-1">
        {user.displayName}
      </span>
      <button
        onClick={onSelect}
        className="px-3 py-1 text-xs font-medium text-lol-gold bg-lol-gold/10 hover:bg-lol-gold/20 border border-lol-gold/30 rounded transition-colors"
      >
        Select
      </button>
    </div>
  );
}
