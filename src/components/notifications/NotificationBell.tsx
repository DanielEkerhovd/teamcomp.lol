import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useNotificationsStore } from '../../stores/useNotificationsStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { formatDistanceToNow } from '../../lib/dateUtils';
import type { Notification } from '../../lib/notificationService';

interface NotificationBellProps {
  collapsed?: boolean;
}

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
      case 'team_role_changed':
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
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
      case 'team_role_changed':
        return 'bg-yellow-500/20 text-yellow-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  const getActionLink = () => {
    switch (notification.type) {
      case 'friend_request':
        return '/friends?tab=pending';
      case 'team_invite':
        return notification.data?.inviteToken ? `/invite/${notification.data.inviteToken}` : null;
      default:
        return null;
    }
  };

  const actionLink = getActionLink();

  const content = (
    <>
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
        <div className="w-2 h-2 rounded-full bg-lol-gold shrink-0" />
      )}
    </>
  );

  if (actionLink) {
    return (
      <Link
        to={actionLink}
        onClick={() => {
          if (!notification.readAt) onMarkRead(notification.id);
          onClose();
        }}
        className={`w-full flex items-start gap-3 p-3 rounded-lg transition-colors text-left ${
          notification.readAt
            ? 'bg-lol-surface/30 hover:bg-lol-surface/50'
            : 'bg-lol-surface hover:bg-lol-border'
        }`}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      onClick={() => !notification.readAt && onMarkRead(notification.id)}
      className={`w-full flex items-start gap-3 p-3 rounded-lg transition-colors text-left ${
        notification.readAt
          ? 'bg-lol-surface/30 hover:bg-lol-surface/50'
          : 'bg-lol-surface hover:bg-lol-border'
      }`}
    >
      {content}
    </button>
  );
}

export default function NotificationBell({ collapsed }: NotificationBellProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { user } = useAuthStore();
  const { notifications, unreadCount, loadNotifications, markAsRead, markAllAsRead, subscribeToRealtime } = useNotificationsStore();

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

  // Filter out message notifications (those go to the messages tab)
  const updateNotifications = notifications.filter(n => n.type !== 'message');
  const recentNotifications = updateNotifications.slice(0, 5);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className={`relative w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 group border ${
          showDropdown
            ? 'bg-lol-gold/10 border-lol-gold/30 text-lol-gold'
            : 'bg-lol-surface/50 border-lol-border hover:border-lol-gold/30 text-gray-400 hover:text-white'
        }`}
      >
        {/* Bell Icon */}
        <span className="relative shrink-0">
          <svg
            className="w-5 h-5"
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
            <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-bold text-white bg-red-500 rounded-full">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </span>

        {/* Label - only show when expanded */}
        {!collapsed && (
          <span className="text-sm font-medium whitespace-nowrap">
            Updates
          </span>
        )}
      </button>

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute left-full bottom-0 ml-2 w-80 bg-lol-card border border-lol-border rounded-xl shadow-2xl overflow-hidden z-[100]">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-lol-border">
            <h3 className="text-sm font-semibold text-white">Updates</h3>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllAsRead()}
                className="text-xs text-gray-500 hover:text-lol-gold transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-80 overflow-y-auto p-2 space-y-1">
            {recentNotifications.length === 0 ? (
              <div className="text-center py-8">
                <svg className="w-10 h-10 text-gray-600 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <p className="text-sm text-gray-500">No updates</p>
                <p className="text-xs text-gray-600 mt-1">
                  Team invites, friend requests, and more will appear here
                </p>
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
          {updateNotifications.length > 5 && (
            <div className="px-4 py-2 border-t border-lol-border text-center">
              <span className="text-xs text-gray-500">
                +{updateNotifications.length - 5} more updates
              </span>
            </div>
          )}
        </div>
      )}

      {/* Tooltip when collapsed and dropdown not showing */}
      {collapsed && !showDropdown && (
        <div className="absolute left-full ml-3 px-3 py-2 bg-lol-card border border-lol-border rounded-lg text-sm text-white whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 shadow-xl z-50">
          Updates
          {unreadCount > 0 && (
            <span className="ml-2 px-1.5 py-0.5 text-xs font-bold text-white bg-red-500 rounded-full">
              {unreadCount}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
