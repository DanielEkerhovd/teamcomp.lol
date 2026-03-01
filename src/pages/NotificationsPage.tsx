import { useEffect, useState, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useNotificationsStore } from '../stores/useNotificationsStore';
import { useMessagesStore } from '../stores/useMessagesStore';
import { useFriendsStore } from '../stores/useFriendsStore';
import { useAuthStore } from '../stores/useAuthStore';
import { formatDistanceToNow, formatDistanceToNowShort } from '../lib/dateUtils';
import type { Notification } from '../lib/notificationService';
import type { Message, ConversationPreview, Friend, ProfileRole } from '../types/database';
import DefaultAvatar from '../components/ui/DefaultAvatar';

// Role display labels
const ROLE_LABELS: Record<ProfileRole, string> = {
  team_owner: 'Team Owner',
  head_coach: 'Head Coach',
  coach: 'Coach',
  analyst: 'Analyst',
  player: 'Player',
  manager: 'Manager',
  scout: 'Scout',
  content_creator: 'Content Creator',
  caster: 'Caster',
  journalist: 'Journalist',
  streamer: 'Streamer',
  groupie: 'Groupie',
  developer: 'Developer',
};

function getRoleDisplay(
  role?: ProfileRole | null,
  roleTeamName?: string | null
): string | null {
  if (!role) return null;

  const roleLabel = ROLE_LABELS[role] || null;
  if (!roleLabel) return null;

  if (roleTeamName) {
    return `${roleLabel} for ${roleTeamName}`;
  }

  return roleLabel;
}

type TabType = 'updates' | 'messages';

// Notification Item Component
function NotificationItem({
  notification,
  onMarkRead,
  onDelete,
}: {
  notification: Notification;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const getIcon = () => {
    switch (notification.type) {
      case 'team_invite':
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
        );
      case 'friend_request':
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        );
      case 'friend_accepted':
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'message':
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        );
      case 'team_role_changed':
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
          </svg>
        );
      case 'draft_invite':
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'moderation':
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
      case 'team_role_changed':
        return 'bg-yellow-500/20 text-yellow-400';
      case 'draft_invite':
        return 'bg-orange-500/20 text-orange-400';
      case 'moderation':
        return 'bg-red-500/20 text-red-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  const getActionLink = () => {
    switch (notification.type) {
      case 'team_invite':
        return '/friends?tab=team_invites';
      case 'friend_request':
        return '/friends?tab=pending';
      case 'team_member_joined':
      case 'team_member_left':
      case 'team_role_changed':
        return notification.data?.teamId ? `/my-teams?team=${notification.data.teamId}` : '/my-teams';
      case 'ownership_transfer_request':
        return '/friends?tab=team_invites';
      case 'ownership_transfer_accepted':
      case 'ownership_transfer_declined':
      case 'ownership_transfer_cancelled':
        return notification.data?.teamId ? `/my-teams?team=${notification.data.teamId}` : '/my-teams';
      case 'draft_invite':
        return notification.data?.inviteToken ? `/live-draft/join/${notification.data.inviteToken}` : null;
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
      <p className={`text-sm font-medium truncate ${notification.readAt ? 'text-gray-400' : 'text-white'}`}>
        {notification.title}
      </p>
      {notification.body && (
        <p className="text-xs text-gray-500 truncate shrink-0 max-w-35">{notification.body}</p>
      )}
      <span className="text-xs text-gray-600 shrink-0 ml-auto">
        {formatDistanceToNow(notification.createdAt)}
      </span>
      <div className="flex items-center gap-1 shrink-0">
        {!notification.readAt && (
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onMarkRead(notification.id); }}
            className="p-1 text-gray-500 hover:text-white rounded transition-colors"
            title="Mark as read"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </button>
        )}
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(notification.id); }}
          className="p-1 text-gray-500 hover:text-red-400 rounded transition-colors"
          title="Delete notification"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </>
  );

  if (actionLink) {
    return (
      <Link
        to={actionLink}
        onClick={() => { if (!notification.readAt) onMarkRead(notification.id); }}
        className={`flex items-center gap-3 p-4 rounded-lg border transition-colors ${
          notification.readAt
            ? 'bg-lol-surface/50 border-lol-border/50 hover:bg-lol-surface/70'
            : 'bg-lol-surface border-lol-gold/30 hover:bg-lol-surface/80'
        }`}
      >
        {content}
      </Link>
    );
  }

  return (
    <div
      className={`flex items-center gap-3 p-4 rounded-lg border transition-colors ${
        notification.readAt
          ? 'bg-lol-surface/50 border-lol-border/50'
          : 'bg-lol-surface border-lol-gold/30'
      }`}
    >
      {content}
    </div>
  );
}

// Conversation Item Component
function ConversationItem({
  conversation,
  friend,
  isActive,
  onClick,
}: {
  conversation: ConversationPreview;
  friend?: Friend;
  isActive: boolean;
  onClick: () => void;
}) {
  const roleDisplay = friend ? getRoleDisplay(friend.role, friend.roleTeamName) : null;

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left ${
        isActive
          ? 'bg-lol-gold/20 border border-lol-gold/30'
          : 'hover:bg-lol-surface border border-transparent'
      }`}
    >
      {conversation.friendAvatar ? (
        <img
          src={conversation.friendAvatar}
          alt={conversation.friendName}
          className="w-10 h-10 rounded-lg object-cover"
        />
      ) : (
        <DefaultAvatar size="w-10 h-10" className="rounded-lg" />
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-white truncate">
            {conversation.friendName}
          </p>
          <span className="text-xs text-gray-500 shrink-0">
            {formatDistanceToNowShort(conversation.lastMessageAt)}
          </span>
        </div>
        {roleDisplay && (
          <p className="text-[9px] font-medium text-lol-gold truncate">
            {roleDisplay}
          </p>
        )}
        <p className={`text-xs truncate mt-0.5 ${
          conversation.lastMessage === 'This message was deleted'
            ? 'text-gray-600 italic'
            : 'text-gray-500'
        }`}>
          {conversation.lastMessage}
        </p>
      </div>

      {conversation.unreadCount > 0 && (
        <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold text-white bg-lol-gold rounded-full">
          {conversation.unreadCount}
        </span>
      )}
    </button>
  );
}

// Message Bubble Component
function MessageBubble({
  message,
  isOwn,
  onRevert,
}: {
  message: Message;
  isOwn: boolean;
  onRevert?: (messageId: string) => void;
}) {
  const isReverted = !!message.revertedAt;

  const avatar = message.senderAvatar ? (
    <img
      src={message.senderAvatar}
      alt=""
      className="w-8 h-8 rounded-full object-cover shrink-0"
      referrerPolicy="no-referrer"
    />
  ) : (
    <DefaultAvatar size="w-8 h-8" className="rounded-full" />
  );

  return (
    <div className={`group flex items-center gap-2.5 ${isOwn ? 'flex-row-reverse' : ''}`}>
      {avatar}
      <div className={`max-w-[70%] flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
        <div className={`flex items-center gap-2 mb-0.5 ${isOwn ? 'flex-row-reverse' : ''}`}>
          <span className={`text-xs font-medium ${isOwn ? 'text-lol-gold' : 'text-gray-300'}`}>
            {message.senderName || 'Unknown'}
          </span>
          <span className="text-[10px] text-gray-500">
            {formatDistanceToNowShort(message.createdAt)}
          </span>
        </div>
        <div className={`flex items-center gap-1.5 ${isOwn ? 'flex-row-reverse' : ''}`}>
          <div
            className={`px-3 py-2 ${
              isReverted
                ? 'bg-lol-surface/50 rounded-2xl'
                : isOwn
                  ? 'bg-lol-gold text-lol-dark rounded-2xl rounded-tr-sm rounded-br-sm'
                  : 'bg-lol-surface text-white rounded-2xl rounded-tl-sm rounded-bl-sm'
            }`}
          >
            {isReverted ? (
              <p className="text-sm italic text-gray-500">This message was deleted</p>
            ) : (
              <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
            )}
          </div>
          {isOwn && !isReverted && onRevert && (
            <button
              onClick={() => onRevert(message.id)}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-500 hover:text-red-400 rounded"
              title="Delete message"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    const tab = searchParams.get('tab');
    return tab === 'messages' ? 'messages' : 'updates';
  });
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showNewConvo, setShowNewConvo] = useState(false);
  const [friendSearch, setFriendSearch] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { user } = useAuthStore();
  const { notifications, unreadCount, loadNotifications, markAsRead, deleteNotification, subscribeToRealtime } = useNotificationsStore();
  const { friends, loadFriends } = useFriendsStore();
  const {
    conversations,
    messages,
    activeConversation,
    isLoading: messagesLoading,
    loadConversations,
    setActiveConversation,
    sendMessage,
    revertMessage,
    subscribeToMessages,
  } = useMessagesStore();

  // Get user ID from URL param for messages
  const urlUserId = searchParams.get('user');

  // Load data on mount
  useEffect(() => {
    if (user) {
      loadNotifications();
      loadConversations();
      loadFriends();
      const unsubNotifications = subscribeToRealtime(user.id);
      const unsubMessages = subscribeToMessages(user.id);
      return () => {
        unsubNotifications();
        unsubMessages();
      };
    }
  }, [user, loadNotifications, loadConversations, loadFriends, subscribeToRealtime, subscribeToMessages]);

  // Set active conversation from URL
  useEffect(() => {
    if (urlUserId && urlUserId !== activeConversation) {
      setActiveConversation(urlUserId);
      setActiveTab('messages');
    }
  }, [urlUserId, activeConversation, setActiveConversation]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeConversation]);

  // Update URL when tab changes
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    if (tab === 'updates') {
      searchParams.delete('tab');
      searchParams.delete('user');
      setActiveConversation(null);
    } else {
      searchParams.set('tab', 'messages');
    }
    setSearchParams(searchParams);
  };

  // Get messages for active conversation
  const currentMessages = activeConversation
    ? messages.get(activeConversation) || []
    : [];

  // Get friend info for active conversation
  const activeFriend = friends.find((f) => f.friendId === activeConversation);
  const activeConvo = conversations.find((c) => c.friendId === activeConversation);

  const handleSelectConversation = (friendId: string) => {
    searchParams.set('user', friendId);
    searchParams.set('tab', 'messages');
    setSearchParams(searchParams);
    setActiveConversation(friendId);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeConversation || isSending) return;

    setIsSending(true);
    const result = await sendMessage(activeConversation, newMessage.trim());

    if (result.success) {
      setNewMessage('');
    }

    setIsSending(false);
  };

  // Calculate unread messages count
  const unreadMessagesCount = conversations.reduce((acc, c) => acc + c.unreadCount, 0);

  // Redirect guests to sign in
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <svg className="w-16 h-16 text-gray-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        <h2 className="text-xl font-semibold text-white mb-2">Sign in to view Notifications</h2>
        <p className="text-gray-400 text-center max-w-md">
          Create an account or sign in to receive notifications and messages.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] -my-6 -mx-8">
      {/* Left Panel - Notifications or Conversation List */}
      <div className="w-96 shrink-0 border-r border-lol-border bg-lol-card flex flex-col">
        {/* Tabs */}
        <div className="flex border-b border-lol-border">
          <button
            onClick={() => handleTabChange('updates')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'updates'
                ? 'text-lol-gold border-b-2 border-lol-gold bg-lol-gold/5'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            Updates
            {unreadCount > 0 && (
              <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 text-xs font-bold text-white bg-red-500 rounded-full">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
          <button
            onClick={() => handleTabChange('messages')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'messages'
                ? 'text-lol-gold border-b-2 border-lol-gold bg-lol-gold/5'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            Messages
            {unreadMessagesCount > 0 && (
              <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 text-xs font-bold text-white bg-lol-gold rounded-full">
                {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
              </span>
            )}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3">
          {activeTab === 'updates' ? (
            // Notifications list (exclude messages — they have their own tab)
            (() => {
              const updateNotifications = notifications.filter(n => n.type !== 'message');
              return updateNotifications.length === 0 ? (
              <div className="text-center py-12">
                <svg className="w-12 h-12 text-gray-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <p className="text-gray-400">No notifications yet</p>
                <p className="text-gray-500 text-sm mt-1">
                  You'll see team invites, friend requests, and more here
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {updateNotifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onMarkRead={markAsRead}
                    onDelete={deleteNotification}
                  />
                ))}
              </div>
            );
            })()
          ) : (
            // Conversations list with new conversation picker
            <>
              {showNewConvo ? (
                <>
                  {/* New conversation header */}
                  <div className="flex items-center gap-2 mb-2">
                    <button
                      onClick={() => { setShowNewConvo(false); setFriendSearch(''); }}
                      className="p-1 text-gray-400 hover:text-white rounded transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <span className="text-sm font-medium text-white">New conversation</span>
                  </div>
                  <input
                    type="text"
                    value={friendSearch}
                    onChange={(e) => setFriendSearch(e.target.value)}
                    placeholder="Search friends..."
                    autoFocus
                    className="w-full bg-lol-surface border border-lol-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-lol-gold/50 transition-colors mb-2"
                  />
                  <div className="space-y-1">
                    {(() => {
                      const convoFriendIds = new Set(conversations.map(c => c.friendId));
                      const availableFriends = friends
                        .filter(f => !convoFriendIds.has(f.friendId))
                        .filter(f => !friendSearch || f.displayName.toLowerCase().includes(friendSearch.toLowerCase()));

                      return availableFriends.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-4">
                          {friends.length === 0 ? 'No friends yet' : friendSearch ? 'No friends match' : 'All friends have conversations'}
                        </p>
                      ) : (
                        availableFriends.map(friend => {
                          const roleDisplay = getRoleDisplay(friend.role, friend.roleTeamName);
                          return (
                            <button
                              key={friend.friendId}
                              onClick={() => {
                                handleSelectConversation(friend.friendId);
                                setShowNewConvo(false);
                                setFriendSearch('');
                              }}
                              className="w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left hover:bg-lol-surface border border-transparent"
                            >
                              {friend.avatarUrl ? (
                                <img src={friend.avatarUrl} alt={friend.displayName} className="w-10 h-10 rounded-lg object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <DefaultAvatar size="w-10 h-10" className="rounded-lg" />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white truncate">{friend.displayName}</p>
                                {roleDisplay && (
                                  <p className="text-[9px] font-medium text-lol-gold truncate">{roleDisplay}</p>
                                )}
                                <p className="text-xs text-gray-600 truncate mt-0.5">Start a conversation</p>
                              </div>
                            </button>
                          );
                        })
                      );
                    })()}
                  </div>
                </>
              ) : (
                <>
                  {/* Conversations header with + button */}
                  {friends.length > 0 && (
                    <div className="flex items-center justify-end mb-2">
                      <button
                        onClick={() => setShowNewConvo(true)}
                        className="p-1.5 text-gray-400 hover:text-lol-gold rounded-lg hover:bg-lol-gold/10 transition-colors"
                        title="New conversation"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                    </div>
                  )}
                  {messagesLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-lol-gold" />
                    </div>
                  ) : conversations.length === 0 ? (
                    <div className="text-center py-12">
                      <svg className="w-12 h-12 text-gray-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      <p className="text-gray-400">No conversations yet</p>
                      <p className="text-gray-500 text-sm mt-1 mb-3">
                        Add friends to start messaging
                      </p>
                      <Link
                        to="/friends"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-lol-gold/10 hover:bg-lol-gold/20 text-lol-gold text-sm font-medium rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                        </svg>
                        Add Friends
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {conversations.map((convo) => (
                        <ConversationItem
                          key={convo.friendId}
                          conversation={convo}
                          friend={friends.find((f) => f.friendId === convo.friendId)}
                          isActive={convo.friendId === activeConversation}
                          onClick={() => handleSelectConversation(convo.friendId)}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Right Panel - Detail View */}
      <div className="flex-1 flex flex-col bg-lol-gray">
        {activeTab === 'updates' ? (
          // Updates detail - empty state or selected notification
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
            <svg className="w-16 h-16 text-gray-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <h2 className="text-xl font-semibold text-white mb-2">Notifications</h2>
            <p className="text-gray-400 max-w-md">
              Team invites, friend requests, and other updates will appear here.
            </p>
          </div>
        ) : activeConversation ? (
          // Message conversation view
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-lol-border bg-lol-card flex items-center gap-3">
              {(activeFriend?.avatarUrl || activeConvo?.friendAvatar) ? (
                <img
                  src={activeFriend?.avatarUrl || activeConvo?.friendAvatar || ''}
                  alt={activeFriend?.displayName || activeConvo?.friendName}
                  className="w-10 h-10 rounded-lg object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <DefaultAvatar size="w-10 h-10" className="rounded-lg" />
              )}
              <div>
                <h3 className="font-medium text-white">
                  {activeFriend?.displayName || activeConvo?.friendName || 'Unknown'}
                </h3>
                {activeFriend && getRoleDisplay(activeFriend.role, activeFriend.roleTeamName) && (
                  <p className="text-[10px] font-medium text-lol-gold">
                    {getRoleDisplay(activeFriend.role, activeFriend.roleTeamName)}
                  </p>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {currentMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <p className="text-gray-500">No messages yet</p>
                  <p className="text-gray-600 text-sm mt-1">
                    Send a message to start the conversation
                  </p>
                </div>
              ) : (
                <>
                  {[...currentMessages].reverse().map((message) => (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      isOwn={message.senderId === user.id}
                      onRevert={(id) => revertMessage(id, activeConversation!)}
                    />
                  ))}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Message Input */}
            <form onSubmit={handleSendMessage} className="px-4 py-3 border-t border-lol-border bg-lol-card">
              <div className="flex items-center gap-2 bg-lol-surface border border-lol-border rounded-full px-4 pr-1.5 py-1.5 focus-within:border-lol-gold/50 transition-colors">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 focus:outline-none min-w-0"
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim() || isSending}
                  className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all disabled:opacity-30 bg-lol-gold text-lol-dark hover:bg-lol-gold-light"
                >
                  {isSending ? (
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                    </svg>
                  )}
                </button>
              </div>
            </form>
          </>
        ) : (
          // No conversation selected
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
            <svg className="w-16 h-16 text-gray-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <h2 className="text-xl font-semibold text-white mb-2">Select a conversation</h2>
            <p className="text-gray-400 max-w-md mb-4">
              Choose a conversation from the list or start a new one with a friend.
            </p>
            <Link
              to="/friends"
              className="inline-flex items-center gap-2 px-4 py-2 bg-lol-gold hover:bg-lol-gold-light text-lol-dark font-medium rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Manage Friends
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
