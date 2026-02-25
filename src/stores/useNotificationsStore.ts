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
      const unreadCount = notifications.filter((n) => !n.readAt).length;
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
    const success = await notificationService.markAsRead(notificationId);
    if (success) {
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === notificationId ? { ...n, readAt: new Date().toISOString() } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
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
    const success = await notificationService.deleteNotification(notificationId);
    if (success) {
      set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== notificationId),
        unreadCount: notification && !notification.readAt
          ? Math.max(0, state.unreadCount - 1)
          : state.unreadCount,
      }));
    }
  },

  addNotification: (notification: Notification) => {
    set((state) => ({
      notifications: [notification, ...state.notifications],
      unreadCount: state.unreadCount + 1,
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
