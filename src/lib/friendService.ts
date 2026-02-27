import { supabase, isSupabaseConfigured } from './supabase';
import {
  Friend,
  PendingFriendRequest,
  BlockedUser,
  FriendsData,
  FriendRequestResponse,
} from '../types/database';
import { RealtimeChannel } from '@supabase/supabase-js';

export const friendService = {
  /**
   * Get all friends and pending requests
   */
  async getFriends(): Promise<FriendsData> {
    if (!isSupabaseConfigured() || !supabase) {
      return { accepted: [], pendingReceived: [], pendingSent: [], blocked: [] };
    }

    const { data, error } = await supabase.rpc('get_friends');

    if (error) {
      console.error('Error fetching friends:', error);
      return { accepted: [], pendingReceived: [], pendingSent: [], blocked: [] };
    }

    // The RPC returns camelCase keys from json_build_object
    const result = data as {
      accepted: Array<{
        friendshipId: string;
        friendId: string;
        displayName: string;
        avatarUrl: string | null;
        acceptedAt: string;
        role: string | null;
        roleTeamName: string | null;
      }>;
      pendingReceived: Array<{
        friendshipId: string;
        fromUserId: string;
        displayName: string;
        avatarUrl: string | null;
        createdAt: string;
        role: string | null;
        roleTeamName: string | null;
      }>;
      pendingSent: Array<{
        friendshipId: string;
        toUserId: string;
        displayName: string;
        avatarUrl: string | null;
        createdAt: string;
        role: string | null;
        roleTeamName: string | null;
      }>;
      blocked: Array<{
        friendshipId: string;
        blockedUserId: string;
        displayName: string;
        avatarUrl: string | null;
        blockedAt: string;
      }>;
    };

    return {
      accepted: result.accepted || [],
      pendingReceived: result.pendingReceived || [],
      pendingSent: result.pendingSent || [],
      blocked: result.blocked || [],
    };
  },

  /**
   * Send a friend request by username or email
   */
  async sendFriendRequest(identifier: string): Promise<FriendRequestResponse> {
    if (!isSupabaseConfigured() || !supabase) {
      return { success: false, error: 'Unable to connect. Please check your internet connection.' };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('send_friend_request', {
      identifier: identifier.trim(),
    });

    if (error) {
      console.error('Error sending friend request:', error);
      // Return user-friendly error message
      if (error.message?.includes('not found') || error.message?.includes('User not found')) {
        return { success: false, error: 'User not found. Please check the username or email.' };
      }
      return { success: false, error: 'Could not send friend request. Please try again.' };
    }

    return data as FriendRequestResponse;
  },

  /**
   * Accept or decline a friend request
   */
  async respondToFriendRequest(
    friendshipId: string,
    accept: boolean
  ): Promise<{ success: boolean; error?: string; friend?: Friend }> {
    if (!isSupabaseConfigured() || !supabase) {
      return { success: false, error: 'Unable to connect. Please check your internet connection.' };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('respond_to_friend_request', {
      p_friendship_id: friendshipId,
      p_accept: accept,
    });

    if (error) {
      console.error('Error responding to friend request:', error);
      return { success: false, error: 'Could not respond to friend request. Please try again.' };
    }

    const result = data as {
      success: boolean;
      error?: string;
      status?: string;
      friend?: {
        id: string;
        displayName: string;
        avatarUrl: string | null;
      };
    };

    if (result.success && result.friend) {
      return {
        success: true,
        friend: {
          friendshipId,
          friendId: result.friend.id,
          displayName: result.friend.displayName,
          avatarUrl: result.friend.avatarUrl,
          acceptedAt: new Date().toISOString(),
        },
      };
    }

    return { success: result.success, error: result.error };
  },

  /**
   * Remove a friend
   */
  async removeFriend(friendshipId: string): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured() || !supabase) {
      return { success: false, error: 'Unable to connect. Please check your internet connection.' };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('remove_friend', {
      p_friendship_id: friendshipId,
    });

    if (error) {
      console.error('Error removing friend:', error);
      return { success: false, error: 'Could not remove friend. Please try again.' };
    }

    return data as { success: boolean; error?: string };
  },

  /**
   * Block a user
   */
  async blockUser(userId: string): Promise<{ success: boolean; error?: string; blockedUser?: BlockedUser }> {
    if (!isSupabaseConfigured() || !supabase) {
      return { success: false, error: 'Unable to connect. Please check your internet connection.' };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('block_user', {
      p_user_id: userId,
    });

    if (error) {
      console.error('Error blocking user:', error);
      return { success: false, error: 'Could not block user. Please try again.' };
    }

    const result = data as {
      success: boolean;
      error?: string;
      blockedUser?: {
        id: string;
        displayName: string;
        avatarUrl: string | null;
      };
    };

    if (result.success && result.blockedUser) {
      return {
        success: true,
        blockedUser: {
          friendshipId: '', // Will be filled by reload
          blockedUserId: result.blockedUser.id,
          displayName: result.blockedUser.displayName,
          avatarUrl: result.blockedUser.avatarUrl,
          blockedAt: new Date().toISOString(),
        },
      };
    }

    return { success: result.success, error: result.error };
  },

  /**
   * Unblock a user
   */
  async unblockUser(userId: string): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured() || !supabase) {
      return { success: false, error: 'Unable to connect. Please check your internet connection.' };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('unblock_user', {
      p_user_id: userId,
    });

    if (error) {
      console.error('Error unblocking user:', error);
      return { success: false, error: 'Could not unblock user. Please try again.' };
    }

    return data as { success: boolean; error?: string };
  },

  /**
   * Search for users by username or email (for friend suggestions)
   */
  async searchUsers(query: string): Promise<Array<{
    id: string;
    displayName: string;
    avatarUrl: string | null;
  }>> {
    if (!isSupabaseConfigured() || !supabase || query.trim().length < 2) {
      return [];
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .or(`display_name.ilike.%${query}%,email.ilike.%${query}%`)
      .limit(10);

    if (error) {
      console.error('Error searching users:', error);
      return [];
    }

    return (data || []).map((u: { id: string; display_name: string | null; avatar_url: string | null }) => ({
      id: u.id,
      displayName: u.display_name || 'Unknown',
      avatarUrl: u.avatar_url,
    }));
  },

  /**
   * Subscribe to real-time friendship updates
   */
  subscribeToRealtime(
    userId: string,
    onUpdate: () => void
  ): () => void {
    if (!isSupabaseConfigured() || !supabase) {
      return () => {};
    }

    const channel: RealtimeChannel = supabase
      .channel(`friendships:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friendships',
          filter: `user_id=eq.${userId}`,
        },
        () => onUpdate()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friendships',
          filter: `friend_id=eq.${userId}`,
        },
        () => onUpdate()
      )
      .subscribe();

    return () => {
      supabase?.removeChannel(channel);
    };
  },
};
