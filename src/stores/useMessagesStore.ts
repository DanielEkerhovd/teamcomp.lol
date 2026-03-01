import { create } from 'zustand';
import { messageService } from '../lib/messageService';
import { checkModerationAndRecord, getViolationWarning } from '../lib/moderation';
import { ConversationPreview, Message } from '../types/database';

// Singleton message subscription — prevents duplicate Supabase channels
let messageSubRefCount = 0;
let messageSubUnsubscribe: (() => void) | null = null;

interface MessagesState {
  conversations: ConversationPreview[];
  activeConversation: string | null;
  messages: Map<string, Message[]>;
  unreadCount: number;
  isLoading: boolean;
  isLoadingMessages: boolean;
  error: string | null;
  // Typing indicators
  typingUsers: Map<string, boolean>;

  // Actions
  loadConversations: () => Promise<void>;
  loadMessages: (friendId: string) => Promise<void>;
  loadMoreMessages: (friendId: string, beforeId: string) => Promise<void>;
  sendMessage: (toUserId: string, content: string) => Promise<{ success: boolean; error?: string }>;
  revertMessage: (messageId: string, friendId: string) => Promise<{ success: boolean; error?: string }>;
  markConversationRead: (friendId: string) => Promise<void>;
  setActiveConversation: (friendId: string | null) => void;
  addMessage: (message: Message) => void;
  updateMessage: (message: Message) => void;
  refreshUnreadCount: () => Promise<void>;
  subscribeToMessages: (userId: string) => () => void;
  // Typing
  setFriendTyping: (friendId: string, isTyping: boolean) => void;
  broadcastTyping: (friendId: string) => void;
  subscribeToTyping: (friendId: string) => () => void;
  reset: () => void;
}

export const useMessagesStore = create<MessagesState>((set, get) => ({
  conversations: [],
  activeConversation: null,
  messages: new Map(),
  unreadCount: 0,
  isLoading: false,
  isLoadingMessages: false,
  error: null,
  typingUsers: new Map(),

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
    set({ isLoadingMessages: true, error: null });
    try {
      const messages = await messageService.getConversation(friendId);
      set((state) => {
        const newMessages = new Map(state.messages);
        newMessages.set(friendId, messages);
        return { messages: newMessages, isLoadingMessages: false };
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load messages',
        isLoadingMessages: false,
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
    // Validate content before optimistic update
    if (!content?.trim()) {
      return { success: false, error: 'Message cannot be empty' };
    }
    if (content.trim().length > 500) {
      return { success: false, error: 'Message must be 500 characters or less' };
    }

    // Check moderation BEFORE showing the message in the UI
    const modResult = await checkModerationAndRecord(content.trim(), 'chat_message');
    if (modResult.flagged) {
      return { success: false, error: getViolationWarning(modResult) };
    }

    // Optimistic: add the message to UI immediately with a temp ID
    const tempId = `temp-${Date.now()}`;
    const supabaseModule = await import('../lib/supabase');
    const authResponse = await supabaseModule.supabase?.auth.getUser();
    const user = authResponse?.data;

    if (user?.user) {
      const optimisticMessage: Message = {
        id: tempId,
        senderId: user.user.id,
        recipientId: toUserId,
        content,
        readAt: null,
        createdAt: new Date().toISOString(),
        revertedAt: null,
        senderName: 'You',
        senderAvatar: null,
      };
      get().addMessage(optimisticMessage);
    }

    const result = await messageService.sendMessage(toUserId, content);
    if (result.success && result.messageId) {
      // Replace temp message with real one
      set((state) => {
        const newMessages = new Map(state.messages);
        const friendMessages = newMessages.get(toUserId);
        if (friendMessages) {
          newMessages.set(
            toUserId,
            friendMessages.map((m) =>
              m.id === tempId ? { ...m, id: result.messageId!, createdAt: result.createdAt || m.createdAt } : m
            )
          );
        }
        return { messages: newMessages };
      });
      // Reload conversations to update preview
      get().loadConversations();
    } else {
      // Remove optimistic message on failure
      set((state) => {
        const newMessages = new Map(state.messages);
        const friendMessages = newMessages.get(toUserId);
        if (friendMessages) {
          newMessages.set(
            toUserId,
            friendMessages.filter((m) => m.id !== tempId)
          );
        }
        return { messages: newMessages };
      });
    }
    return { success: result.success, error: result.error };
  },

  revertMessage: async (messageId: string, friendId: string) => {
    // Optimistic: mark as reverted in UI immediately
    set((state) => {
      const newMessages = new Map(state.messages);
      const friendMessages = newMessages.get(friendId);
      if (friendMessages) {
        newMessages.set(
          friendId,
          friendMessages.map((m) =>
            m.id === messageId
              ? { ...m, revertedAt: new Date().toISOString(), content: 'This message was deleted' }
              : m
          )
        );
      }
      return { messages: newMessages };
    });

    const result = await messageService.revertMessage(messageId);

    if (!result.success) {
      // Rollback: reload from server
      get().loadMessages(friendId);
    }

    // Refresh conversation previews
    get().loadConversations();

    return { success: result.success, error: result.error };
  },

  updateMessage: (message: Message) => {
    set((state) => {
      const friendId = message.senderId;
      const newMessages = new Map(state.messages);
      const friendMessages = newMessages.get(friendId);
      if (friendMessages) {
        newMessages.set(
          friendId,
          friendMessages.map((m) => (m.id === message.id ? message : m))
        );
      }
      return { messages: newMessages };
    });
    get().loadConversations();
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
      // Optimistically clear the unread badge immediately
      set((state) => ({
        conversations: state.conversations.map((c) =>
          c.friendId === friendId ? { ...c, unreadCount: 0 } : c
        ),
      }));
      // Load messages and mark as read in the DB
      get().loadMessages(friendId);
      get().markConversationRead(friendId);
    }
  },

  addMessage: (message: Message) => {
    set((state) => {
      // Determine which friend this message belongs to (the conversation key)
      let friendId: string | null = null;
      if (message.senderId === state.activeConversation) {
        // Message FROM the active friend TO us
        friendId = message.senderId;
      } else if (message.recipientId === state.activeConversation) {
        // Message FROM us TO the active friend
        friendId = message.recipientId;
      }

      if (!friendId) {
        // Message for a conversation not currently active
        // Just increment unread count and refresh conversations
        return { unreadCount: state.unreadCount + 1 };
      }

      const newMessages = new Map(state.messages);
      const existing = newMessages.get(friendId) || [];
      // Add to beginning (messages are ordered newest first)
      newMessages.set(friendId, [message, ...existing]);

      return { messages: newMessages };
    });
  },

  refreshUnreadCount: async () => {
    const count = await messageService.getUnreadCount();
    set({ unreadCount: count });
  },

  subscribeToMessages: (userId: string) => {
    messageSubRefCount++;
    if (messageSubRefCount === 1) {
      // First subscriber — create the single channel
      messageSubUnsubscribe = messageService.subscribeToMessages(
        userId,
        (message) => {
          get().addMessage(message);
          // Clear typing indicator for the sender (they sent a message, so they stopped typing)
          get().setFriendTyping(message.senderId, false);
          // Also refresh conversations
          get().loadConversations();
        },
        (updatedMessage) => {
          // Handle realtime message updates (reverts from the other user)
          get().updateMessage(updatedMessage);
        }
      );
    }
    return () => {
      messageSubRefCount--;
      if (messageSubRefCount <= 0) {
        messageSubRefCount = 0;
        messageSubUnsubscribe?.();
        messageSubUnsubscribe = null;
      }
    };
  },

  setFriendTyping: (friendId: string, isTyping: boolean) => {
    set((state) => {
      const newTyping = new Map(state.typingUsers);
      if (isTyping) {
        newTyping.set(friendId, true);
      } else {
        newTyping.delete(friendId);
      }
      return { typingUsers: newTyping };
    });
  },

  broadcastTyping: (friendId: string) => {
    const supabaseModule = import('../lib/supabase');
    supabaseModule.then(async (mod) => {
      const authResponse = await mod.supabase?.auth.getUser();
      const myUserId = authResponse?.data?.user?.id;
      if (myUserId) {
        messageService.broadcastTyping(myUserId, friendId);
      }
    });
  },

  subscribeToTyping: (friendId: string) => {
    // We need the current user ID synchronously-ish
    let unsubscribe = () => {};
    import('../lib/supabase').then(async (mod) => {
      const authResponse = await mod.supabase?.auth.getUser();
      const myUserId = authResponse?.data?.user?.id;
      if (myUserId) {
        unsubscribe = messageService.subscribeToTyping(myUserId, friendId, (isTyping) => {
          get().setFriendTyping(friendId, isTyping);
        });
      }
    });
    return () => unsubscribe();
  },

  reset: () => {
    set({
      conversations: [],
      activeConversation: null,
      messages: new Map(),
      unreadCount: 0,
      isLoading: false,
      isLoadingMessages: false,
      error: null,
      typingUsers: new Map(),
    });
  },
}));
