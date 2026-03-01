import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useFriendsStore } from '../stores/useFriendsStore';
import { useMessagesStore } from '../stores/useMessagesStore';
import { useNotificationsStore } from '../stores/useNotificationsStore';
import { useAuthStore } from '../stores/useAuthStore';
import { FriendCard, PendingRequestCard, BlockedUserCard } from '../components/social/FriendCard';
import AddFriendModal from '../components/social/AddFriendModal';
import { formatDistanceToNow, formatDistanceToNowShort } from '../lib/dateUtils';
import type { Notification } from '../lib/notificationService';
import { teamMembershipService, PendingTeamInvite } from '../lib/teamMembershipService';
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

type Tab = 'friends' | 'pending' | 'sent' | 'messages' | 'blocked' | 'team_invites' | 'notifications';

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
  const initials = message.senderName?.slice(0, 2).toUpperCase() || '??';

  const avatar = message.senderAvatar ? (
    <img
      src={message.senderAvatar}
      alt=""
      className="w-8 h-8 rounded-full object-cover shrink-0"
      referrerPolicy="no-referrer"
    />
  ) : (
    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-lol-gold to-lol-gold-light flex items-center justify-center text-lol-dark font-semibold text-[10px] shrink-0">
      {initials}
    </div>
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
        return '/social?tab=team_invites';
      case 'friend_request':
        return '/social?tab=pending';
      case 'team_member_joined':
      case 'team_member_left':
      case 'team_role_changed':
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
      <div className="flex items-center gap-1 shrink-0 self-center">
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
      <a
        href={actionLink}
        onClick={() => { if (!notification.readAt) onMarkRead(notification.id); }}
        className={`flex items-start gap-3 p-4 rounded-lg border transition-colors ${
          notification.readAt
            ? 'bg-lol-surface/50 border-lol-border/50 hover:bg-lol-surface/70'
            : 'bg-lol-surface border-lol-gold/30 hover:bg-lol-surface/80'
        }`}
      >
        {content}
      </a>
    );
  }

  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-lg border transition-colors ${
        notification.readAt
          ? 'bg-lol-surface/50 border-lol-border/50'
          : 'bg-lol-surface border-lol-gold/30'
      }`}
    >
      {content}
    </div>
  );
}

export default function FriendsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const tab = searchParams.get('tab');
    if (tab === 'messages' || tab === 'pending' || tab === 'sent' || tab === 'blocked' || tab === 'team_invites' || tab === 'notifications') return tab;
    return 'friends';
  });
  const [showAddModal, setShowAddModal] = useState(false);
  const [friendSearch, setFriendSearch] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [showNewConvo, setShowNewConvo] = useState(false);
  const [newConvoSearch, setNewConvoSearch] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Team invites state
  const [teamInvites, setTeamInvites] = useState<PendingTeamInvite[]>([]);
  const [teamInvitesLoading, setTeamInvitesLoading] = useState(false);
  const [respondingInviteId] = useState<string | null>(null);

  const { user } = useAuthStore();
  const {
    friends,
    pendingReceived,
    pendingSent,
    blocked,
    isLoading,
    loadFriends,
    acceptRequest,
    declineRequest,
    removeFriend,
    blockUser,
    unblockUser,
    subscribeToRealtime,
  } = useFriendsStore();

  const {
    conversations,
    messages,
    activeConversation,
    isLoading: messagesLoading,
    typingUsers,
    loadConversations,
    setActiveConversation,
    sendMessage,
    revertMessage,
    subscribeToMessages,
    broadcastTyping,
    subscribeToTyping,
  } = useMessagesStore();

  const {
    notifications,
    unreadCount: notifUnreadCount,
    loadNotifications,
    markAsRead: markNotifAsRead,
    markAllAsRead: markAllNotifsAsRead,
    deleteNotification,
    subscribeToRealtime: subscribeNotifications,
  } = useNotificationsStore();

  // Get user ID from URL param for messages
  const urlUserId = searchParams.get('user');

  useEffect(() => {
    if (user) {
      loadFriends();
      loadConversations();
      loadNotifications();
      const unsubFriends = subscribeToRealtime(user.id);
      const unsubMessages = subscribeToMessages(user.id);
      const unsubNotifications = subscribeNotifications(user.id);
      return () => {
        unsubFriends();
        unsubMessages();
        unsubNotifications();
      };
    }
  }, [user, loadFriends, loadConversations, loadNotifications, subscribeToRealtime, subscribeToMessages, subscribeNotifications]);

  // Set active conversation from URL
  useEffect(() => {
    if (urlUserId && urlUserId !== activeConversation) {
      setActiveConversation(urlUserId);
      setActiveTab('messages');
    }
  }, [urlUserId, activeConversation, setActiveConversation]);

  // Subscribe to typing indicators for the active conversation
  useEffect(() => {
    if (activeConversation) {
      const unsub = subscribeToTyping(activeConversation);
      return unsub;
    }
  }, [activeConversation, subscribeToTyping]);

  // Debounced typing broadcast
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleTyping = useCallback(() => {
    if (!activeConversation) return;
    broadcastTyping(activeConversation);
    // Debounce: don't spam broadcasts, send at most once per 2s
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      typingTimeoutRef.current = null;
    }, 2000);
  }, [activeConversation, broadcastTyping]);

  const isFriendTyping = activeConversation ? typingUsers.get(activeConversation) : false;

  // Scroll to bottom when messages change or typing indicator appears
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeConversation, isFriendTyping]);

  // Handle tab from URL
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'messages' || tab === 'pending' || tab === 'sent' || tab === 'blocked' || tab === 'team_invites' || tab === 'notifications') {
      setActiveTab(tab);
    }
  }, [searchParams]);

  // Load team invites
  const loadTeamInvites = async () => {
    setTeamInvitesLoading(true);
    try {
      const invites = await teamMembershipService.getPendingTeamInvitesForUser();
      setTeamInvites(invites);
    } catch (err) {
      console.error('Failed to load team invites:', err);
    } finally {
      setTeamInvitesLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadTeamInvites();
    }
  }, [user]);

  const handleRespondToTeamInvite = async (inviteId: string, accept: boolean) => {
    const invite = teamInvites.find(i => i.inviteId === inviteId);

    // Optimistic: remove invite from list immediately
    setTeamInvites(prev => prev.filter(i => i.inviteId !== inviteId));

    try {
      const result = await teamMembershipService.respondToTeamInvite(inviteId, accept);
      if (result.success) {
        // Navigate to the team page after accepting
        if (accept && result.teamId) {
          navigate(`/my-teams?team=${result.teamId}`);
        }
      } else if (invite) {
        // Revert on failure
        setTeamInvites(prev => [...prev, invite]);
      }
    } catch (err) {
      console.error('Failed to respond to invite:', err);
      // Revert on error
      if (invite) {
        setTeamInvites(prev => [...prev, invite]);
      }
    }
  };

  // Redirect guests to sign in
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <svg className="w-16 h-16 text-gray-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        <h2 className="text-xl font-semibold text-white mb-2">Sign in to access Friends</h2>
        <p className="text-gray-400 text-center max-w-md">
          Create an account or sign in to add friends, send messages, and collaborate on teams.
        </p>
      </div>
    );
  }

  // Calculate unread messages count
  const unreadMessagesCount = conversations.reduce((acc, c) => acc + c.unreadCount, 0);

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'friends', label: 'Friends' },
    { id: 'messages', label: 'Messages', count: unreadMessagesCount },
    { id: 'notifications', label: 'Notifications', count: notifUnreadCount },
    { id: 'pending', label: 'Requests', count: pendingReceived.length },
    { id: 'team_invites', label: 'Team Invites', count: teamInvites.length },
    { id: 'sent', label: 'Sent', count: pendingSent.length },
    { id: 'blocked', label: 'Blocked', count: blocked.length },
  ];

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    if (tab !== 'messages') {
      searchParams.delete('user');
      setActiveConversation(null);
    }
    searchParams.set('tab', tab);
    setSearchParams(searchParams);
  };

  const handleMessage = (friendId: string) => {
    searchParams.set('tab', 'messages');
    searchParams.set('user', friendId);
    setSearchParams(searchParams);
    setActiveConversation(friendId);
    setActiveTab('messages');
  };

  const handleSelectConversation = (friendId: string) => {
    searchParams.set('user', friendId);
    setSearchParams(searchParams);
    setActiveConversation(friendId);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeConversation || isSending) return;

    const messageText = newMessage.trim();
    // Optimistic: clear input immediately
    setNewMessage('');
    setIsSending(true);

    const result = await sendMessage(activeConversation, messageText);

    if (!result.success) {
      // Restore message on failure so user can retry
      setNewMessage(messageText);
      if (result.error) {
        setSendError(result.error);
        setTimeout(() => setSendError(null), 4000);
      }
    }

    setIsSending(false);
  };

  // Get messages for active conversation
  const currentMessages = activeConversation
    ? messages.get(activeConversation) || []
    : [];

  // Get friend info for active conversation
  const activeFriend = friends.find((f) => f.friendId === activeConversation);
  const activeConvo = conversations.find((c) => c.friendId === activeConversation);

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Social</h1>
        <p className="text-gray-400 text-sm mt-1">
          Manage your friends, messages, notifications, and requests
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-lol-surface rounded-lg border border-lol-border mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-lol-gold/20 text-lol-gold'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className={`px-1.5 py-0.5 text-xs rounded-full ${
                activeTab === tab.id ? 'bg-lol-gold text-lol-dark' : 'bg-gray-700 text-gray-300'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-lol-gold" />
        </div>
      ) : (
        <>
          {/* Friends Tab */}
          {activeTab === 'friends' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-lol-gold hover:bg-lol-gold-light text-lol-dark font-medium rounded-lg transition-colors shrink-0"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                  Add Friend
                </button>
                <div className="relative flex-1">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    value={friendSearch}
                    onChange={(e) => setFriendSearch(e.target.value)}
                    placeholder="Search friends..."
                    className="w-full pl-9 pr-3 py-2 bg-lol-surface border border-lol-border rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-lol-gold/50 transition-colors"
                  />
                </div>
              </div>
              {friends.length === 0 && !friendSearch ? (
                <div className="text-center py-12">
                  <svg className="w-12 h-12 text-gray-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <p className="text-gray-400">No friends yet</p>
                  <p className="text-gray-500 text-sm mt-1">Add friends to collaborate on teams</p>
                </div>
              ) : (
                <>
                  {friends
                    .filter((f) => f.displayName.toLowerCase().includes(friendSearch.toLowerCase()))
                    .map((friend) => (
                      <FriendCard
                        key={friend.friendshipId}
                        friend={friend}
                        onRemove={() => removeFriend(friend.friendshipId)}
                        onMessage={() => handleMessage(friend.friendId)}
                        onBlock={() => blockUser(friend.friendId)}
                      />
                    ))}
                  {friendSearch && friends.filter((f) => f.displayName.toLowerCase().includes(friendSearch.toLowerCase())).length === 0 && (
                    <p className="text-center text-gray-500 text-sm py-6">No friends matching "{friendSearch}"</p>
                  )}
                </>
              )}
            </div>
          )}

          {/* Messages Tab */}
          {activeTab === 'messages' && (
            <div className="flex h-[calc(100vh-16rem)] bg-lol-card rounded-xl border border-lol-border overflow-hidden">
              {/* Conversation List */}
              <div className="w-72 shrink-0 border-r border-lol-border flex flex-col">
                <div className="p-3 border-b border-lol-border flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-400">
                    {showNewConvo ? 'New conversation' : 'Conversations'}
                  </h3>
                  {showNewConvo ? (
                    <button
                      onClick={() => { setShowNewConvo(false); setNewConvoSearch(''); }}
                      className="p-1 text-gray-400 hover:text-white rounded transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  ) : friends.length > 0 && (
                    <button
                      onClick={() => setShowNewConvo(true)}
                      className="p-1 text-gray-400 hover:text-lol-gold rounded-lg hover:bg-lol-gold/10 transition-colors"
                      title="New conversation"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {showNewConvo ? (
                    <>
                      <input
                        type="text"
                        value={newConvoSearch}
                        onChange={(e) => setNewConvoSearch(e.target.value)}
                        placeholder="Search friends..."
                        autoFocus
                        className="w-full bg-lol-surface border border-lol-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-lol-gold/50 transition-colors mb-2"
                      />
                      {(() => {
                        const convoFriendIds = new Set(conversations.map(c => c.friendId));
                        const availableFriends = friends
                          .filter(f => !convoFriendIds.has(f.friendId))
                          .filter(f => !newConvoSearch || f.displayName.toLowerCase().includes(newConvoSearch.toLowerCase()));

                        return availableFriends.length === 0 ? (
                          <p className="text-sm text-gray-500 text-center py-4">
                            {friends.length === 0 ? 'No friends yet' : newConvoSearch ? 'No friends match' : 'All friends have conversations'}
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
                                  setNewConvoSearch('');
                                }}
                                className="w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left hover:bg-lol-surface border border-transparent"
                              >
                                {friend.avatarUrl ? (
                                  <img src={friend.avatarUrl} alt={friend.displayName} className="w-10 h-10 rounded-lg object-cover" />
                                ) : (
                                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-lol-gold to-lol-gold-light flex items-center justify-center text-lol-dark">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                  </div>
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
                    </>
                  ) : messagesLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-lol-gold" />
                    </div>
                  ) : conversations.length === 0 ? (
                    <div className="text-center py-8 px-4">
                      <svg className="w-10 h-10 text-gray-600 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      <p className="text-sm text-gray-500">No conversations</p>
                      <p className="text-xs text-gray-600 mt-1">
                        Message a friend to start chatting
                      </p>
                    </div>
                  ) : (
                    conversations.map((convo) => (
                      <ConversationItem
                        key={convo.friendId}
                        conversation={convo}
                        friend={friends.find((f) => f.friendId === convo.friendId)}
                        isActive={convo.friendId === activeConversation}
                        onClick={() => handleSelectConversation(convo.friendId)}
                      />
                    ))
                  )}
                </div>
              </div>

              {/* Message View */}
              <div className="flex-1 flex flex-col bg-lol-gray">
                {activeConversation ? (
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
                              onRevert={(id) => revertMessage(id, activeConversation!)}
                            />
                          ))}
                          {isFriendTyping && (
                            <div className="flex items-center gap-2.5">
                              {(activeFriend?.avatarUrl || activeConvo?.friendAvatar) ? (
                                <img
                                  src={activeFriend?.avatarUrl || activeConvo?.friendAvatar || ''}
                                  alt=""
                                  className="w-8 h-8 rounded-full object-cover shrink-0"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-lol-gold to-lol-gold-light flex items-center justify-center text-lol-dark font-semibold text-[10px] shrink-0">
                                  {(activeFriend?.displayName || activeConvo?.friendName || '??').slice(0, 2).toUpperCase()}
                                </div>
                              )}
                              <div className="px-3 py-2 bg-lol-surface rounded-2xl rounded-tl-sm rounded-bl-sm">
                                <div className="flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
                                </div>
                              </div>
                            </div>
                          )}
                          <div ref={messagesEndRef} />
                        </>
                      )}
                    </div>

                    {/* Send error */}
                    {sendError && (
                      <div className="px-4 py-2 bg-red-900/60 border-t border-red-700/50 text-red-200 text-xs text-center">
                        {sendError}
                      </div>
                    )}

                    {/* Message Input */}
                    <form onSubmit={handleSendMessage} className="px-4 py-3 border-t border-lol-border bg-lol-card">
                      <div className="flex items-center gap-2 bg-lol-surface border border-lol-border rounded-full px-4 pr-1.5 py-1.5 focus-within:border-lol-gold/50 transition-colors">
                        <input
                          type="text"
                          value={newMessage}
                          onChange={(e) => {
                            setNewMessage(e.target.value);
                            if (e.target.value.trim()) handleTyping();
                          }}
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
                  <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
                    <svg className="w-16 h-16 text-gray-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <h2 className="text-xl font-semibold text-white mb-2">Select a conversation</h2>
                    <p className="text-gray-400 max-w-md">
                      Choose a conversation from the list or message a friend from the Friends tab.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <div className="space-y-3">
              {/* Mark all read header */}
              {notifUnreadCount > 0 && (
                <div className="flex items-center justify-end">
                  <button
                    onClick={() => markAllNotifsAsRead()}
                    className="text-sm text-gray-500 hover:text-lol-gold transition-colors"
                  >
                    Mark all as read
                  </button>
                </div>
              )}

              {(() => {
                const updateNotifications = notifications.filter(n => n.type !== 'message');
                return updateNotifications.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="w-12 h-12 text-gray-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  <p className="text-gray-400">No notifications yet</p>
                  <p className="text-gray-500 text-sm mt-1">
                    Team invites, friend requests, and other updates will appear here
                  </p>
                </div>
              ) : (
                updateNotifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onMarkRead={markNotifAsRead}
                    onDelete={deleteNotification}
                  />
                ))
              );
              })()}
            </div>
          )}

          {/* Pending Tab */}
          {activeTab === 'pending' && (
            <div className="space-y-3">
              {pendingReceived.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="w-12 h-12 text-gray-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                  <p className="text-gray-400">No pending requests</p>
                </div>
              ) : (
                pendingReceived.map((request) => (
                  <PendingRequestCard
                    key={request.friendshipId}
                    request={request}
                    type="received"
                    onAccept={() => acceptRequest(request.friendshipId)}
                    onDecline={() => declineRequest(request.friendshipId)}
                    onBlock={() => blockUser(request.fromUserId!)}
                  />
                ))
              )}
            </div>
          )}

          {/* Sent Tab */}
          {activeTab === 'sent' && (
            <div className="space-y-3">
              {pendingSent.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="w-12 h-12 text-gray-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  <p className="text-gray-400">No sent requests</p>
                </div>
              ) : (
                pendingSent.map((request) => (
                  <PendingRequestCard
                    key={request.friendshipId}
                    request={request}
                    type="sent"
                    onCancel={() => removeFriend(request.friendshipId)}
                  />
                ))
              )}
            </div>
          )}

          {/* Blocked Tab */}
          {activeTab === 'blocked' && (
            <div className="space-y-3">
              {blocked.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="w-12 h-12 text-gray-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                  <p className="text-gray-400">No blocked users</p>
                </div>
              ) : (
                blocked.map((blockedUser) => (
                  <BlockedUserCard
                    key={blockedUser.friendshipId}
                    blockedUser={blockedUser}
                    onUnblock={() => unblockUser(blockedUser.blockedUserId)}
                  />
                ))
              )}
            </div>
          )}

          {/* Team Invites Tab */}
          {activeTab === 'team_invites' && (
            <div className="space-y-3">
              {teamInvitesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-lol-gold" />
                </div>
              ) : teamInvites.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="w-12 h-12 text-gray-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <p className="text-gray-400">No team invites</p>
                  <p className="text-gray-500 text-sm mt-1">Team invitations will appear here</p>
                </div>
              ) : (
                teamInvites.map((invite) => (
                  <TeamInviteCard
                    key={invite.inviteId}
                    invite={invite}
                    onAccept={() => handleRespondToTeamInvite(invite.inviteId, true)}
                    onDecline={() => handleRespondToTeamInvite(invite.inviteId, false)}
                    isResponding={respondingInviteId === invite.inviteId}
                  />
                ))
              )}
            </div>
          )}
        </>
      )}

      {/* Add Friend Modal */}
      <AddFriendModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
      />
    </div>
  );
}

// Team Invite Card Component
function TeamInviteCard({
  invite,
  onAccept,
  onDecline,
  isResponding,
}: {
  invite: PendingTeamInvite;
  onAccept: () => void;
  onDecline: () => void;
  isResponding: boolean;
}) {
  const expiresIn = Math.ceil((new Date(invite.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  return (
    <div className="flex items-center gap-4 p-4 bg-lol-card rounded-xl border border-lol-border">
      {/* Inviter Avatar */}
      {invite.invitedBy.avatarUrl ? (
        <img
          src={invite.invitedBy.avatarUrl}
          alt={invite.invitedBy.displayName}
          className="w-12 h-12 rounded-lg object-cover"
        />
      ) : (
        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-lol-gold to-lol-gold-light flex items-center justify-center text-lol-dark font-semibold">
          {invite.invitedBy.displayName.slice(0, 2).toUpperCase()}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-white">{invite.invitedBy.displayName}</span>
          <span className="text-gray-400">invited you to join</span>
          <span className="font-medium text-lol-gold">{invite.teamName}</span>
        </div>
        <div className="flex items-center gap-3 mt-1">
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
            invite.role === 'admin'
              ? 'bg-purple-500/20 text-purple-400'
              : invite.role === 'player'
              ? 'bg-green-500/20 text-green-400'
              : 'bg-blue-500/20 text-blue-400'
          }`}>
            {invite.role}
          </span>
          {invite.canEditGroups && invite.role === 'player' && (
            <span className="text-xs text-gray-500">+ can edit groups</span>
          )}
          <span className="text-xs text-gray-500">
            Expires in {expiresIn} day{expiresIn !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={onDecline}
          disabled={isResponding}
          className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white hover:bg-lol-surface rounded-lg transition-colors disabled:opacity-50"
        >
          Decline
        </button>
        <button
          onClick={onAccept}
          disabled={isResponding}
          className="px-4 py-2 text-sm font-medium bg-lol-gold hover:bg-lol-gold-light text-lol-dark rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {isResponding ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-lol-dark" />
          ) : (
            'Accept'
          )}
        </button>
      </div>
    </div>
  );
}
