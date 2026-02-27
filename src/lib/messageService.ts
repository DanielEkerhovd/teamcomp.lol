import { supabase, isSupabaseConfigured } from './supabase';
import { ConversationPreview, Message, SendMessageResponse } from '../types/database';
import { RealtimeChannel } from '@supabase/supabase-js';

export const messageService = {
  /**
   * Get conversation previews (most recent message per friend)
   */
  async getConversationPreviews(): Promise<ConversationPreview[]> {
    if (!isSupabaseConfigured() || !supabase) {
      return [];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('get_conversation_previews');

    if (error) {
      console.error('Error fetching conversation previews:', error);
      return [];
    }

    // Transform from snake_case to camelCase
    return ((data || []) as Array<{
      friend_id: string;
      friend_name: string;
      friend_avatar: string | null;
      last_message: string;
      last_message_at: string;
      last_message_by: string;
      unread_count: number;
    }>).map((c: {
      friend_id: string;
      friend_name: string;
      friend_avatar: string | null;
      last_message: string;
      last_message_at: string;
      last_message_by: string;
      unread_count: number;
    }) => ({
      friendId: c.friend_id,
      friendName: c.friend_name,
      friendAvatar: c.friend_avatar,
      lastMessage: c.last_message,
      lastMessageAt: c.last_message_at,
      lastMessageBy: c.last_message_by,
      unreadCount: c.unread_count,
    }));
  },

  /**
   * Get messages in a conversation with a specific user
   */
  async getConversation(
    otherUserId: string,
    limit = 50,
    beforeId?: string
  ): Promise<Message[]> {
    if (!isSupabaseConfigured() || !supabase) {
      return [];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('get_conversation', {
      p_other_user_id: otherUserId,
      p_limit: limit,
      p_before_id: beforeId || null,
    });

    if (error) {
      console.error('Error fetching conversation:', error);
      return [];
    }

    // Transform from snake_case to camelCase
    return ((data || []) as Array<{
      id: string;
      sender_id: string;
      recipient_id: string;
      content: string;
      read_at: string | null;
      created_at: string;
      sender_name: string;
      sender_avatar: string | null;
    }>).map((m: {
      id: string;
      sender_id: string;
      recipient_id: string;
      content: string;
      read_at: string | null;
      created_at: string;
      sender_name: string;
      sender_avatar: string | null;
    }) => ({
      id: m.id,
      senderId: m.sender_id,
      recipientId: m.recipient_id,
      content: m.content,
      readAt: m.read_at,
      createdAt: m.created_at,
      senderName: m.sender_name,
      senderAvatar: m.sender_avatar,
    }));
  },

  /**
   * Send a message to a friend
   */
  async sendMessage(toUserId: string, content: string): Promise<SendMessageResponse> {
    if (!isSupabaseConfigured() || !supabase) {
      return { success: false, error: 'Not connected to server' };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('send_message', {
      p_to_user_id: toUserId,
      p_content: content,
    });

    if (error) {
      console.error('Error sending message:', error);
      return { success: false, error: 'Could not send message. Please try again.' };
    }

    return data as SendMessageResponse;
  },

  /**
   * Mark a message as read
   */
  async markMessageRead(messageId: string): Promise<boolean> {
    if (!isSupabaseConfigured() || !supabase) {
      return false;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('mark_message_read', {
      p_message_id: messageId,
    });

    if (error) {
      console.error('Error marking message as read:', error);
      return false;
    }

    return data || false;
  },

  /**
   * Mark all messages from a user as read
   */
  async markConversationRead(otherUserId: string): Promise<number> {
    if (!isSupabaseConfigured() || !supabase) {
      return 0;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('mark_conversation_read', {
      p_other_user_id: otherUserId,
    });

    if (error) {
      console.error('Error marking conversation as read:', error);
      return 0;
    }

    return data || 0;
  },

  /**
   * Get total unread message count
   */
  async getUnreadCount(): Promise<number> {
    if (!isSupabaseConfigured() || !supabase) {
      return 0;
    }

    const { data, error } = await supabase.rpc('get_unread_message_count');

    if (error) {
      console.error('Error getting unread message count:', error);
      return 0;
    }

    return data || 0;
  },

  /**
   * Subscribe to real-time messages
   */
  subscribeToMessages(
    userId: string,
    onMessage: (message: Message) => void
  ): () => void {
    if (!isSupabaseConfigured() || !supabase) {
      return () => {};
    }

    const channel: RealtimeChannel = supabase
      .channel(`messages:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `recipient_id=eq.${userId}`,
        },
        async (payload) => {
          // Fetch sender info
          const newMessage = payload.new as {
            id: string;
            sender_id: string;
            recipient_id: string;
            content: string;
            read_at: string | null;
            created_at: string;
          };

          const { data: sender } = await supabase!
            .from('profiles')
            .select('display_name, avatar_url')
            .eq('id', newMessage.sender_id)
            .single();

          const senderData = sender as { display_name: string | null; avatar_url: string | null } | null;

          onMessage({
            id: newMessage.id,
            senderId: newMessage.sender_id,
            recipientId: newMessage.recipient_id,
            content: newMessage.content,
            readAt: newMessage.read_at,
            createdAt: newMessage.created_at,
            senderName: senderData?.display_name || 'Unknown',
            senderAvatar: senderData?.avatar_url || null,
          });
        }
      )
      .subscribe();

    return () => {
      supabase?.removeChannel(channel);
    };
  },
};
