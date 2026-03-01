import { create } from 'zustand';
import { notificationService, Notification } from '../lib/notificationService';

interface NotificationsState {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadNotifications: () => Promise<void>;
  refreshUnreadCount: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  addNotification: (notification: Notification) => void;
  subscribeToRealtime: (userId: string) => () => void;
  reset: () => void;
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  error: null,

  loadNotifications: async () => {
    set({ isLoading: true, error: null });
    try {
      const notifications = await notificationService.getNotifications();
      // Exclude message-type notifications from unread count (messages have their own unread tracking)
      const unreadCount = notifications.filter((n) => !n.readAt && n.type !== 'message').length;
      set({ notifications, unreadCount, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load notifications',
        isLoading: false,
      });
    }
  },

  refreshUnreadCount: async () => {
    const count = await notificationService.getUnreadCount();
    set({ unreadCount: count });
  },

  markAsRead: async (notificationId: string) => {
    const notification = get().notifications.find((n) => n.id === notificationId);
    const shouldDecrement = notification && !notification.readAt && notification.type !== 'message';

    // Optimistic: mark as read immediately in UI
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === notificationId ? { ...n, readAt: new Date().toISOString() } : n
      ),
      unreadCount: shouldDecrement ? Math.max(0, state.unreadCount - 1) : state.unreadCount,
    }));

    const success = await notificationService.markAsRead(notificationId);
    if (!success && notification) {
      // Revert on failure
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === notificationId ? { ...n, readAt: notification.readAt } : n
        ),
        unreadCount: shouldDecrement ? state.unreadCount + 1 : state.unreadCount,
      }));
    }
  },

  markAllAsRead: async () => {
    await notificationService.markAllAsRead();
    set((state) => ({
      notifications: state.notifications.map((n) => ({
        ...n,
        readAt: n.readAt || new Date().toISOString(),
      })),
      unreadCount: 0,
    }));
  },

  deleteNotification: async (notificationId: string) => {
    const notification = get().notifications.find((n) => n.id === notificationId);

    // Optimistic: remove immediately from UI
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== notificationId),
      unreadCount: notification && !notification.readAt && notification.type !== 'message'
        ? Math.max(0, state.unreadCount - 1)
        : state.unreadCount,
    }));

    const success = await notificationService.deleteNotification(notificationId);
    if (!success && notification) {
      // Revert on failure
      set((state) => ({
        notifications: [...state.notifications, notification].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ),
        unreadCount: notification.readAt || notification.type === 'message'
          ? state.unreadCount
          : state.unreadCount + 1,
      }));
    }
  },

  addNotification: (notification: Notification) => {
    set((state) => ({
      notifications: [notification, ...state.notifications],
      // Only increment unreadCount for non-message notifications
      unreadCount: notification.type !== 'message' ? state.unreadCount + 1 : state.unreadCount,
    }));
  },

  subscribeToRealtime: (userId: string) => {
    return notificationService.subscribeToRealtime(userId, (notification) => {
      get().addNotification(notification);
    });
  },

  reset: () => {
    set({
      notifications: [],
      unreadCount: 0,
      isLoading: false,
      error: null,
    });
  },
}));
