import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useNotificationsStore } from '../../stores/useNotificationsStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { formatDistanceToNow } from '../../lib/dateUtils';
import type { Notification } from '../../lib/notificationService';

function NotificationItem({
  notification,
  onMarkRead,
  onClose,
}: {
  notification: Notification;
  onMarkRead: (id: string) => void;
  onClose: () => void;
}) {
  const getIcon = () => {
    switch (notification.type) {
      case 'team_invite':
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
        );
      case 'friend_request':
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        );
      case 'friend_accepted':
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'message':
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        );
    }
  };

  const getIconBgColor = () => {
    switch (notification.type) {
      case 'team_invite':
        return 'bg-blue-500/20 text-blue-400';
      case 'friend_request':
        return 'bg-purple-500/20 text-purple-400';
      case 'friend_accepted':
        return 'bg-green-500/20 text-green-400';
      case 'message':
        return 'bg-lol-gold/20 text-lol-gold';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  const handleClick = () => {
    if (!notification.readAt) {
      onMarkRead(notification.id);
    }
    // Navigate based on notification type
    if (notification.type === 'friend_request') {
      onClose();
    } else if (notification.type === 'team_invite' && notification.data?.inviteToken) {
      onClose();
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`w-full flex items-start gap-3 p-3 rounded-lg transition-colors text-left ${
        notification.readAt
          ? 'bg-lol-surface/30 hover:bg-lol-surface/50'
          : 'bg-lol-surface hover:bg-lol-border'
      }`}
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${getIconBgColor()}`}>
        {getIcon()}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${notification.readAt ? 'text-gray-400' : 'text-white'}`}>
          {notification.title}
        </p>
        {notification.body && (
          <p className="text-xs text-gray-500 truncate mt-0.5">{notification.body}</p>
        )}
        <p className="text-xs text-gray-600 mt-1">
          {formatDistanceToNow(notification.createdAt)}
        </p>
      </div>
      {!notification.readAt && (
        <div className="w-2 h-2 rounded-full bg-lol-gold shrink-0 mt-2" />
      )}
    </button>
  );
}

export default function Header() {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { user } = useAuthStore();
  const { notifications, unreadCount, loadNotifications, markAsRead, subscribeToRealtime } = useNotificationsStore();

  // Load notifications and subscribe when authenticated
  useEffect(() => {
    if (user) {
      loadNotifications();
      const unsubscribe = subscribeToRealtime(user.id);
      return unsubscribe;
    }
  }, [user, loadNotifications, subscribeToRealtime]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showDropdown]);

  // Don't render for guests
  if (!user) return null;

  const recentNotifications = notifications.slice(0, 5);

  return (
    <header className="h-14 bg-lol-dark/80 backdrop-blur-sm border-b border-lol-border flex items-center justify-end px-6">
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="relative p-2 rounded-lg bg-lol-surface/50 border border-lol-border hover:border-lol-gold/50 transition-all duration-200 group"
          title="Notifications"
        >
          {/* Bell Icon */}
          <svg
            className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>

          {/* Unread Badge */}
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-xs font-bold text-white bg-red-500 rounded-full">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {/* Dropdown */}
        {showDropdown && (
          <div className="absolute right-0 top-full mt-2 w-80 bg-lol-card border border-lol-border rounded-xl shadow-xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-lol-border">
              <h3 className="text-sm font-semibold text-white">Notifications</h3>
              {unreadCount > 0 && (
                <span className="text-xs text-gray-500">{unreadCount} unread</span>
              )}
            </div>

            {/* Notifications List */}
            <div className="max-h-80 overflow-y-auto p-2 space-y-1">
              {recentNotifications.length === 0 ? (
                <div className="text-center py-8">
                  <svg className="w-10 h-10 text-gray-600 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  <p className="text-sm text-gray-500">No notifications</p>
                </div>
              ) : (
                recentNotifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onMarkRead={markAsRead}
                    onClose={() => setShowDropdown(false)}
                  />
                ))
              )}
            </div>

            {/* Footer */}
            {notifications.length > 5 && (
              <div className="px-4 py-2 border-t border-lol-border">
                <Link
                  to="/social"
                  onClick={() => setShowDropdown(false)}
                  className="text-xs text-lol-gold hover:text-lol-gold-light transition-colors"
                >
                  View all notifications
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
