import { supabase, isSupabaseConfigured } from './supabase';
import { DbNotification, NotificationType } from '../types/database';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface Notification {
  id: string;
  type: DbNotification['type'];
  title: string;
  body: string | null;
  data: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

function transformNotification(row: DbNotification): Notification {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    data: row.data,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

export const notificationService = {
  /**
   * Get notifications for the current user
   */
  async getNotifications(limit = 50): Promise<Notification[]> {
    if (!isSupabaseConfigured() || !supabase) {
      return [];
    }

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching notifications:', error);
      return [];
    }

    return (data || []).map(transformNotification);
  },

  /**
   * Get unread notification count
   */
  async getUnreadCount(): Promise<number> {
    if (!isSupabaseConfigured() || !supabase) {
      return 0;
    }

    const { data, error } = await supabase.rpc('get_unread_notification_count');

    if (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }

    return data || 0;
  },

  /**
   * Mark a notification as read
   */
  async markAsRead(notificationId: string): Promise<boolean> {
    if (!isSupabaseConfigured() || !supabase) {
      return false;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('mark_notification_read', {
      p_notification_id: notificationId,
    });

    if (error) {
      console.error('Error marking notification as read:', error);
      return false;
    }

    return data || false;
  },

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(): Promise<number> {
    if (!isSupabaseConfigured() || !supabase) {
      return 0;
    }

    const { data, error } = await supabase.rpc('mark_all_notifications_read');

    if (error) {
      console.error('Error marking all notifications as read:', error);
      return 0;
    }

    return data || 0;
  },

  /**
   * Delete a notification
   */
  async deleteNotification(notificationId: string): Promise<boolean> {
    if (!isSupabaseConfigured() || !supabase) {
      return false;
    }

    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId);

    if (error) {
      console.error('Error deleting notification:', error);
      return false;
    }

    return true;
  },

  /**
   * Send a notification to a user
   */
  async sendNotification(
    userId: string,
    type: NotificationType,
    title: string,
    body?: string,
    data?: Record<string, unknown>
  ): Promise<boolean> {
    if (!isSupabaseConfigured() || !supabase) {
      return false;
    }

    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type,
        title,
        body: body || null,
        data: data || {},
      });

    if (error) {
      console.error('Error sending notification:', error);
      return false;
    }

    return true;
  },

  /**
   * Send notifications to multiple users
   */
  async sendNotificationToMany(
    userIds: string[],
    type: NotificationType,
    title: string,
    body?: string,
    data?: Record<string, unknown>
  ): Promise<boolean> {
    if (!isSupabaseConfigured() || !supabase || userIds.length === 0) {
      return false;
    }

    const notifications = userIds.map(userId => ({
      user_id: userId,
      type,
      title,
      body: body || null,
      data: data || {},
    }));

    const { error } = await supabase
      .from('notifications')
      .insert(notifications);

    if (error) {
      console.error('Error sending notifications:', error);
      return false;
    }

    return true;
  },

  /**
   * Subscribe to real-time notifications
   * Returns an unsubscribe function
   */
  subscribeToRealtime(
    userId: string,
    onNotification: (notification: Notification) => void
  ): () => void {
    if (!isSupabaseConfigured() || !supabase) {
      return () => {};
    }

    const channel: RealtimeChannel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const notification = transformNotification(payload.new as DbNotification);
          onNotification(notification);
        }
      )
      .subscribe();

    return () => {
      supabase?.removeChannel(channel);
    };
  },
};
