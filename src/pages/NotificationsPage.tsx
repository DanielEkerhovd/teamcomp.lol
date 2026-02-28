import { useEffect, useState, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useNotificationsStore } from '../stores/useNotificationsStore';
import { useMessagesStore } from '../stores/useMessagesStore';
import { useFriendsStore } from '../stores/useFriendsStore';
import { useAuthStore } from '../stores/useAuthStore';
import { formatDistanceToNow, formatDistanceToNowShort } from '../lib/dateUtils';
import type { Notification } from '../lib/notificationService';
import type { Message, ConversationPreview, Friend, ProfileRole } from '../types/database';

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
}: {
  notification: Notification;
  onMarkRead: (id: string) => void;
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
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-lg border transition-colors ${
        notification.readAt
          ? 'bg-lol-surface/50 border-lol-border/50'
          : 'bg-lol-surface border-lol-gold/30'
      }`}
    >
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${getIconBgColor()}`}>
        {getIcon()}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${notification.readAt ? 'text-gray-400' : 'text-white'}`}>
          {notification.title}
        </p>
        {notification.body && (
          <p className="text-xs text-gray-500 mt-0.5">{notification.body}</p>
        )}
        <p className="text-xs text-gray-600 mt-1">
          {formatDistanceToNow(notification.createdAt)}
        </p>
      </div>
      {!notification.readAt && (
        <button
          onClick={() => onMarkRead(notification.id)}
          className="shrink-0 p-1 text-gray-500 hover:text-white rounded transition-colors"
          title="Mark as read"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </button>
      )}
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
  const initials = conversation.friendName?.slice(0, 2).toUpperCase() || '??';
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
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-lol-gold to-lol-gold-light flex items-center justify-center text-lol-dark font-semibold text-sm">
          {initials}
        </div>
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
        <p className="text-xs text-gray-500 truncate mt-0.5">
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
function MessageBubble({ message, isOwn }: { message: Message; isOwn: boolean }) {
  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[70%] px-4 py-2 rounded-2xl ${
          isOwn
            ? 'bg-lol-gold text-lol-dark rounded-br-md'
            : 'bg-lol-surface text-white rounded-bl-md'
        }`}
      >
        <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
        <p
          className={`text-xs mt-1 ${
            isOwn ? 'text-lol-dark/60' : 'text-gray-500'
          }`}
        >
          {formatDistanceToNowShort(message.createdAt)}
        </p>
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { user } = useAuthStore();
  const { notifications, unreadCount, loadNotifications, markAsRead, subscribeToRealtime } = useNotificationsStore();
  const { friends, loadFriends } = useFriendsStore();
  const {
    conversations,
    messages,
    activeConversation,
    isLoading: messagesLoading,
    loadConversations,
    setActiveConversation,
    sendMessage,
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
            // Notifications list
            notifications.length === 0 ? (
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
                {notifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onMarkRead={markAsRead}
                  />
                ))}
              </div>
            )
          ) : (
            // Conversations list
            messagesLoading ? (
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
            )
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
                />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-lol-gold to-lol-gold-light flex items-center justify-center text-lol-dark font-semibold text-sm">
                  {(activeFriend?.displayName || activeConvo?.friendName || '??').slice(0, 2).toUpperCase()}
                </div>
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
                    />
                  ))}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Message Input */}
            <form onSubmit={handleSendMessage} className="p-4 border-t border-lol-border bg-lol-card">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-2 bg-lol-surface border border-lol-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-lol-gold"
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim() || isSending}
                  className="px-4 py-2 bg-lol-gold hover:bg-lol-gold-light text-lol-dark font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSending ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-lol-dark" />
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
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
