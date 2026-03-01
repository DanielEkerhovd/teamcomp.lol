import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/useAuthStore';
import { useFriendsStore } from '../../stores/useFriendsStore';
import { useMessagesStore } from '../../stores/useMessagesStore';
import { useNotificationsStore } from '../../stores/useNotificationsStore';
import { formatDistanceToNow } from '../../lib/dateUtils';
import type { Notification } from '../../lib/notificationService';
import LoginModal from './LoginModal';
import DefaultAvatar from '../ui/DefaultAvatar';

function getNotifIcon(type: Notification['type']) {
  switch (type) {
    case 'team_invite':
      return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />;
    case 'friend_request':
      return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />;
    case 'friend_accepted':
      return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />;
    case 'draft_invite':
      return <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></>;
    case 'ownership_transfer_request':
    case 'ownership_transfer_accepted':
    case 'ownership_transfer_declined':
    case 'ownership_transfer_cancelled':
      return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />;
    case 'moderation':
      return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />;
    default:
      return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />;
  }
}

function getNotifColor(type: Notification['type']) {
  switch (type) {
    case 'team_invite': return 'bg-blue-500/20 text-blue-400';
    case 'friend_request': return 'bg-purple-500/20 text-purple-400';
    case 'friend_accepted': return 'bg-green-500/20 text-green-400';
    case 'team_role_changed': return 'bg-yellow-500/20 text-yellow-400';
    case 'draft_invite': return 'bg-orange-500/20 text-orange-400';
    case 'ownership_transfer_request': return 'bg-amber-500/20 text-amber-400';
    case 'ownership_transfer_accepted': return 'bg-green-500/20 text-green-400';
    case 'ownership_transfer_declined':
    case 'ownership_transfer_cancelled': return 'bg-red-500/20 text-red-400';
    case 'moderation': return 'bg-red-500/20 text-red-400';
    default: return 'bg-gray-500/20 text-gray-400';
  }
}

function getNotifActionLink(notification: Notification): string | null {
  switch (notification.type) {
    case 'friend_request':
      return '/friends?tab=pending';
    case 'team_invite':
      return '/friends?tab=team_invites';
    case 'team_member_joined':
    case 'team_member_left':
    case 'team_role_changed':
      return notification.data?.teamId ? `/my-teams?team=${notification.data.teamId}` : '/my-teams';
    case 'draft_invite':
      return notification.data?.inviteToken ? `/live-draft/join/${notification.data.inviteToken}` : null;
    case 'ownership_transfer_request':
      return '/friends?tab=team_invites';
    case 'ownership_transfer_accepted':
    case 'ownership_transfer_declined':
    case 'ownership_transfer_cancelled':
      return notification.data?.teamId ? `/my-teams?team=${notification.data.teamId}` : '/my-teams';
    default:
      return null;
  }
}

function NotificationDropdownItem({
  notification,
  onMarkRead,
  onNavigate,
}: {
  notification: Notification;
  onMarkRead: (id: string) => void;
  onNavigate: (path: string) => void;
}) {
  const actionLink = getNotifActionLink(notification);

  const handleClick = () => {
    onMarkRead(notification.id);
    if (actionLink) {
      onNavigate(actionLink);
    }
  };

  return (
    <button
      onClick={handleClick}
      className="w-full flex items-start gap-2 p-2 rounded-lg bg-lol-surface hover:bg-lol-border transition-colors text-left"
    >
      <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${getNotifColor(notification.type)}`}>
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          {getNotifIcon(notification.type)}
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-white truncate">{notification.title}</p>
        {notification.body && (
          <p className="text-[10px] text-gray-500 truncate mt-0.5">{notification.body}</p>
        )}
        <p className="text-[10px] text-gray-600 mt-0.5">
          {formatDistanceToNow(notification.createdAt)}
        </p>
      </div>
      <div className="w-1.5 h-1.5 rounded-full bg-lol-gold shrink-0 mt-1.5" />
    </button>
  );
}

interface UserMenuProps {
  collapsed: boolean;
}

export default function UserMenu({ collapsed }: UserMenuProps) {
  const navigate = useNavigate();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const { user, profile, isLoading, signOut } = useAuthStore();
  const { pendingReceived, loadFriends, subscribeToRealtime: subscribeFriends } = useFriendsStore();
  const { conversations, loadConversations, subscribeToMessages } = useMessagesStore();
  const { notifications, unreadCount: notifUnreadCount, loadNotifications, markAsRead: markNotifAsRead, markAllAsRead: markAllNotifsAsRead, subscribeToRealtime: subscribeNotifications } = useNotificationsStore();

  const isAuthenticated = !!user;

  // Subscribe to real-time updates for friends, messages, and notifications
  useEffect(() => {
    if (user) {
      loadFriends();
      loadConversations();
      loadNotifications();
      const unsubFriends = subscribeFriends(user.id);
      const unsubMessages = subscribeToMessages(user.id);
      const unsubNotifications = subscribeNotifications(user.id);
      return () => {
        unsubFriends();
        unsubMessages();
        unsubNotifications();
      };
    }
  }, [user, loadFriends, loadConversations, loadNotifications, subscribeFriends, subscribeToMessages, subscribeNotifications]);

  // Calculate badge counts
  const pendingRequestsCount = pendingReceived.length;
  const unreadMessagesCount = conversations.reduce((acc, c) => acc + c.unreadCount, 0);
  const totalUnread = pendingRequestsCount + notifUnreadCount;
  const unreadNotifications = notifications.filter((n) => !n.readAt && n.type !== 'message');

  const handleSignOut = async () => {
    await signOut();
    setShowDropdown(false);
  };

  const handleNavigate = (path: string) => {
    navigate(path);
    setShowDropdown(false);
  };

  // Guest user display
  if (!isAuthenticated) {
    return (
      <div className="relative">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className={`flex items-center w-full py-3 rounded-xl bg-lol-surface/50 border border-lol-border hover:border-lol-gold/50 transition-all duration-300 group relative ${
            collapsed ? 'justify-center px-2' : 'px-3'
          }`}
        >
          <div className="w-9 h-9 shrink-0 rounded-lg bg-gradient-to-br from-gray-600 to-gray-700 flex items-center justify-center text-white font-semibold text-sm">
            ?
          </div>
          <div className={`min-w-0 text-left transition-all duration-300 overflow-hidden ${collapsed ? 'max-w-0 opacity-0 ml-0' : 'max-w-[200px] opacity-100 ml-3'}`}>
            <div className="text-sm font-medium text-white truncate">Guest User</div>
            <div className="text-xs text-gray-400">Click for options</div>
          </div>
          {collapsed && (
            <div className="absolute left-full ml-3 px-3 py-2 bg-lol-card border border-lol-border rounded-lg text-sm text-white whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 shadow-xl z-50">
              Guest User
            </div>
          )}
        </button>

        {/* Guest Dropdown Menu */}
        {showDropdown && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowDropdown(false)}
            />

            {/* Menu */}
            <div className={`absolute bg-lol-card border border-lol-border rounded-xl shadow-xl z-50 overflow-hidden ${
              collapsed ? 'left-full bottom-0 ml-2 w-48' : 'bottom-full left-0 right-0 mb-2'
            }`}>
              <div className="p-1">
                <button
                  onClick={() => handleNavigate('/profile')}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-lol-surface rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Settings
                </button>

                <button
                  onClick={() => {
                    setShowDropdown(false);
                    setShowLoginModal(true);
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-lol-gold hover:text-lol-gold-light hover:bg-lol-surface rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                  Sign In
                </button>
              </div>
            </div>
          </>
        )}

        <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
      </div>
    );
  }

  // Authenticated user display
  const displayName = profile?.displayName || user.email?.split('@')[0] || 'User';

  // Show custom role if set, otherwise fall back to tier badge
  const formatRole = (role: string) =>
    role.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  const roleLabel = profile?.role
    ? formatRole(profile.role) + (profile.roleTeamName ? ` for ${profile.roleTeamName}` : '')
    : null;
  const subtitleText = roleLabel ?? (
    profile?.tier === 'developer' ? 'Developer' : profile?.tier === 'beta' ? 'Beta' : profile?.tier === 'paid' ? 'Pro' : profile?.tier === 'admin' ? 'Admin' : 'Free'
  );
  const subtitleColor = profile?.role
    ? 'text-lol-gold'
    : profile?.tier === 'developer' ? 'text-emerald-400' : profile?.tier === 'beta' ? 'text-blue-400' : profile?.tier === 'paid' ? 'text-lol-gold' : profile?.tier === 'admin' ? 'text-purple-400' : 'text-gray-400';

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className={`flex items-center w-full py-3 rounded-xl bg-lol-surface/50 border border-lol-border hover:border-lol-gold/50 transition-all duration-300 group ${
          collapsed ? 'justify-center px-2' : 'px-3'
        }`}
      >
        {/* Avatar with aggregate badge */}
        <span className="relative shrink-0">
          {profile?.avatarUrl ? (
            <div className="size-9 rounded-lg overflow-hidden">
              <img
                src={profile.avatarUrl}
                alt={displayName}
                className="w-full h-full object-cover scale-110"
                referrerPolicy="no-referrer"
              />
            </div>
          ) : (
            <DefaultAvatar size="size-9" className="rounded-lg" />
          )}
          {totalUnread > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-bold text-white bg-red-500 rounded-full ring-2 ring-lol-dark">
              {totalUnread > 99 ? '99+' : totalUnread}
            </span>
          )}
        </span>

        <div className={`min-w-0 text-left transition-all duration-300 overflow-hidden ${collapsed ? 'max-w-0 opacity-0 ml-0' : 'max-w-[200px] opacity-100 ml-3'}`}>
          <div className="text-sm font-medium text-white truncate">{displayName}</div>
          {profile?.role && profile.roleTeamName ? (
            <div className={`text-xs leading-tight ${subtitleColor}`}>
              <div className="truncate">{formatRole(profile.role)} for</div>
              <div className="truncate">{profile.roleTeamName}</div>
            </div>
          ) : (
            <div className={`text-xs leading-tight truncate ${subtitleColor}`}>{subtitleText}</div>
          )}
        </div>
        {collapsed && (
          <div className="absolute left-full ml-3 px-3 py-2 bg-lol-card border border-lol-border rounded-lg text-sm text-white whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 shadow-xl z-50">
            {displayName}
            {totalUnread > 0 && (
              <span className="ml-2 px-1.5 py-0.5 text-xs font-bold text-white bg-red-500 rounded-full">
                {totalUnread}
              </span>
            )}
          </div>
        )}
      </button>

      {/* Dropdown Menu + Notification Panel */}
      {showDropdown && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowDropdown(false)}
          />

          {/* Stacked panels: notifications on top, menu below */}
          <div className={`absolute z-50 flex flex-col gap-2 ${
            collapsed ? 'left-full bottom-0 ml-2' : 'bottom-full left-0 right-0 mb-2'
          }`}>
            {/* Recent Notifications — separate box on top */}
            {unreadNotifications.length > 0 && (
              <div className={`bg-lol-card border border-lol-border rounded-xl shadow-xl overflow-hidden ${
                collapsed ? 'w-52' : ''
              }`}>
                <div className="flex items-center justify-between px-3 py-2 border-b border-lol-border">
                  <span className="text-xs font-semibold text-white">Recent Notifications</span>
                  <button
                    onClick={() => markAllNotifsAsRead()}
                    className="text-[10px] text-gray-500 hover:text-lol-gold transition-colors"
                  >
                    Mark all read
                  </button>
                </div>
                <div className="max-h-48 overflow-y-auto p-1.5 space-y-1">
                  {unreadNotifications.slice(0, 4).map((n) => (
                    <NotificationDropdownItem
                      key={n.id}
                      notification={n}
                      onMarkRead={markNotifAsRead}
                      onNavigate={handleNavigate}
                    />
                  ))}
                </div>
                {unreadNotifications.length > 4 && (
                  <div className="px-3 py-1.5 border-t border-lol-border">
                    <button
                      onClick={() => handleNavigate('/friends?tab=notifications')}
                      className="w-full text-center text-[11px] text-gray-500 hover:text-lol-gold transition-colors"
                    >
                      +{unreadNotifications.length - 4} more — View all
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Menu */}
            <div className={`bg-lol-card border border-lol-border rounded-xl shadow-xl overflow-hidden ${
              collapsed ? 'w-52' : ''
            }`}>
              <div className="p-1">
                {/* Friends */}
                <button
                  onClick={() => handleNavigate('/friends')}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-lol-surface rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <span className="flex-1 text-left">Friends</span>
                  {pendingRequestsCount > 0 && (
                    <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-purple-500 rounded-full">
                      {pendingRequestsCount > 99 ? '99+' : pendingRequestsCount}
                    </span>
                  )}
                </button>

                {/* Messages */}
                <button
                  onClick={() => handleNavigate('/friends?tab=messages')}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-lol-surface rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <span className="flex-1 text-left">Messages</span>
                  {unreadMessagesCount > 0 && (
                    <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-lol-gold rounded-full">
                      {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
                    </span>
                  )}
                </button>

                {/* Notifications */}
                <button
                  onClick={() => handleNavigate('/friends?tab=notifications')}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-lol-surface rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  <span className="flex-1 text-left">Notifications</span>
                </button>

                {/* Divider */}
                <div className="my-1 border-t border-lol-border" />

                {/* Settings */}
                <button
                  onClick={() => handleNavigate('/profile')}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-lol-surface rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Settings
                </button>

                {/* Sign Out */}
                <button
                  onClick={handleSignOut}
                  disabled={isLoading}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-lol-surface rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  {isLoading ? 'Signing out...' : 'Sign Out'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
