import { create } from 'zustand';
import { messageService } from '../lib/messageService';
import { ConversationPreview, Message } from '../types/database';

interface MessagesState {
  conversations: ConversationPreview[];
  activeConversation: string | null;
  messages: Map<string, Message[]>;
  unreadCount: number;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadConversations: () => Promise<void>;
  loadMessages: (friendId: string) => Promise<void>;
  loadMoreMessages: (friendId: string, beforeId: string) => Promise<void>;
  sendMessage: (toUserId: string, content: string) => Promise<{ success: boolean; error?: string }>;
  markConversationRead: (friendId: string) => Promise<void>;
  setActiveConversation: (friendId: string | null) => void;
  addMessage: (message: Message) => void;
  refreshUnreadCount: () => Promise<void>;
  subscribeToMessages: (userId: string) => () => void;
  reset: () => void;
}

export const useMessagesStore = create<MessagesState>((set, get) => ({
  conversations: [],
  activeConversation: null,
  messages: new Map(),
  unreadCount: 0,
  isLoading: false,
  error: null,

  loadConversations: async () => {
    set({ isLoading: true, error: null });
    try {
      const conversations = await messageService.getConversationPreviews();
      const unreadCount = conversations.reduce((sum, c) => sum + c.unreadCount, 0);
      set({ conversations, unreadCount, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load conversations',
        isLoading: false,
      });
    }
  },

  loadMessages: async (friendId: string) => {
    set({ isLoading: true, error: null });
    try {
      const messages = await messageService.getConversation(friendId);
      set((state) => {
        const newMessages = new Map(state.messages);
        newMessages.set(friendId, messages);
        return { messages: newMessages, isLoading: false };
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load messages',
        isLoading: false,
      });
    }
  },

  loadMoreMessages: async (friendId: string, beforeId: string) => {
    try {
      const moreMessages = await messageService.getConversation(friendId, 50, beforeId);
      if (moreMessages.length > 0) {
        set((state) => {
          const newMessages = new Map(state.messages);
          const existing = newMessages.get(friendId) || [];
          newMessages.set(friendId, [...existing, ...moreMessages]);
          return { messages: newMessages };
        });
      }
    } catch (error) {
      console.error('Error loading more messages:', error);
    }
  },

  sendMessage: async (toUserId: string, content: string) => {
    const result = await messageService.sendMessage(toUserId, content);
    if (result.success && result.messageId) {
      // Add the message to local state immediately
      const supabaseModule = await import('../lib/supabase');
      const authResponse = await supabaseModule.supabase?.auth.getUser();
      const user = authResponse?.data;
      if (user?.user) {
        const newMessage: Message = {
          id: result.messageId,
          senderId: user.user.id,
          recipientId: toUserId,
          content,
          readAt: null,
          createdAt: result.createdAt || new Date().toISOString(),
          senderName: 'You',
          senderAvatar: null,
        };
        get().addMessage(newMessage);
      }
      // Reload conversations to update preview
      await get().loadConversations();
    }
    return { success: result.success, error: result.error };
  },

  markConversationRead: async (friendId: string) => {
    const markedCount = await messageService.markConversationRead(friendId);
    if (markedCount > 0) {
      set((state) => {
        // Update local message state
        const newMessages = new Map(state.messages);
        const friendMessages = newMessages.get(friendId);
        if (friendMessages) {
          newMessages.set(
            friendId,
            friendMessages.map((m) =>
              m.senderId === friendId && !m.readAt
                ? { ...m, readAt: new Date().toISOString() }
                : m
            )
          );
        }

        // Update conversation preview
        const newConversations = state.conversations.map((c) =>
          c.friendId === friendId ? { ...c, unreadCount: 0 } : c
        );

        return {
          messages: newMessages,
          conversations: newConversations,
          unreadCount: Math.max(0, state.unreadCount - markedCount),
        };
      });
    }
  },

  setActiveConversation: (friendId: string | null) => {
    set({ activeConversation: friendId });
    if (friendId) {
      // Load messages and mark as read
      get().loadMessages(friendId);
      get().markConversationRead(friendId);
    }
  },

  addMessage: (message: Message) => {
    set((state) => {
      const otherUserId =
        message.senderId === state.activeConversation
          ? message.senderId
          : message.recipientId === state.activeConversation
          ? message.senderId
          : null;

      if (!otherUserId) {
        // Message for a conversation not currently active
        // Just increment unread count and refresh conversations
        return { unreadCount: state.unreadCount + 1 };
      }

      const newMessages = new Map(state.messages);
      const existing = newMessages.get(otherUserId) || [];
      // Add to beginning (messages are ordered newest first)
      newMessages.set(otherUserId, [message, ...existing]);

      return { messages: newMessages };
    });
  },

  refreshUnreadCount: async () => {
    const count = await messageService.getUnreadCount();
    set({ unreadCount: count });
  },

  subscribeToMessages: (userId: string) => {
    return messageService.subscribeToMessages(userId, (message) => {
      get().addMessage(message);
      // Also refresh conversations
      get().loadConversations();
    });
  },

  reset: () => {
    set({
      conversations: [],
      activeConversation: null,
      messages: new Map(),
      unreadCount: 0,
      isLoading: false,
      error: null,
    });
  },
}));
