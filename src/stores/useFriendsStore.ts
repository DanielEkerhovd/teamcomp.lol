import { create } from 'zustand';
import { friendService } from '../lib/friendService';
import { Friend, PendingFriendRequest, BlockedUser } from '../types/database';

interface FriendsState {
  friends: Friend[];
  pendingReceived: PendingFriendRequest[];
  pendingSent: PendingFriendRequest[];
  blocked: BlockedUser[];
  isLoading: boolean;
  error: string | null;

  // Actions
  loadFriends: () => Promise<void>;
  sendRequest: (identifier: string) => Promise<{ success: boolean; error?: string }>;
  acceptRequest: (friendshipId: string) => Promise<void>;
  declineRequest: (friendshipId: string) => Promise<void>;
  removeFriend: (friendshipId: string) => Promise<void>;
  blockUser: (userId: string) => Promise<{ success: boolean; error?: string }>;
  unblockUser: (userId: string) => Promise<{ success: boolean; error?: string }>;
  subscribeToRealtime: (userId: string) => () => void;
  reset: () => void;
}

export const useFriendsStore = create<FriendsState>((set, get) => ({
  friends: [],
  pendingReceived: [],
  pendingSent: [],
  blocked: [],
  isLoading: false,
  error: null,

  loadFriends: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await friendService.getFriends();
      set({
        friends: data.accepted,
        pendingReceived: data.pendingReceived,
        pendingSent: data.pendingSent,
        blocked: data.blocked,
        isLoading: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load friends',
        isLoading: false,
      });
    }
  },

  sendRequest: async (identifier: string) => {
    const result = await friendService.sendFriendRequest(identifier);
    if (result.success) {
      // If it was an auto-accept (they had already sent us a request), reload
      if (result.message === 'Friend request accepted') {
        await get().loadFriends();
      } else if (result.targetUser) {
        // Add to pending sent
        set((state) => ({
          pendingSent: [
            ...state.pendingSent,
            {
              friendshipId: result.friendshipId!,
              toUserId: result.targetUser!.id,
              displayName: result.targetUser!.displayName,
              avatarUrl: result.targetUser!.avatarUrl,
              createdAt: new Date().toISOString(),
            },
          ],
        }));
      }
    }
    return { success: result.success, error: result.error };
  },

  acceptRequest: async (friendshipId: string) => {
    const result = await friendService.respondToFriendRequest(friendshipId, true);
    if (result.success && result.friend) {
      set((state) => ({
        pendingReceived: state.pendingReceived.filter((p) => p.friendshipId !== friendshipId),
        friends: [...state.friends, result.friend!],
      }));
    }
  },

  declineRequest: async (friendshipId: string) => {
    const result = await friendService.respondToFriendRequest(friendshipId, false);
    if (result.success) {
      set((state) => ({
        pendingReceived: state.pendingReceived.filter((p) => p.friendshipId !== friendshipId),
      }));
    }
  },

  removeFriend: async (friendshipId: string) => {
    const result = await friendService.removeFriend(friendshipId);
    if (result.success) {
      set((state) => ({
        friends: state.friends.filter((f) => f.friendshipId !== friendshipId),
        pendingSent: state.pendingSent.filter((p) => p.friendshipId !== friendshipId),
      }));
    }
  },

  blockUser: async (userId: string) => {
    const result = await friendService.blockUser(userId);
    if (result.success) {
      // Reload to get the updated state (removes from friends, adds to blocked)
      await get().loadFriends();
    }
    return { success: result.success, error: result.error };
  },

  unblockUser: async (userId: string) => {
    const result = await friendService.unblockUser(userId);
    if (result.success) {
      set((state) => ({
        blocked: state.blocked.filter((b) => b.blockedUserId !== userId),
      }));
    }
    return { success: result.success, error: result.error };
  },

  subscribeToRealtime: (userId: string) => {
    return friendService.subscribeToRealtime(userId, () => {
      // Reload friends on any change
      get().loadFriends();
    });
  },

  reset: () => {
    set({
      friends: [],
      pendingReceived: [],
      pendingSent: [],
      blocked: [],
      isLoading: false,
      error: null,
    });
  },
}));
