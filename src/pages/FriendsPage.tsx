import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useFriendsStore } from '../stores/useFriendsStore';
import { useMessagesStore } from '../stores/useMessagesStore';
import { useAuthStore } from '../stores/useAuthStore';
import { FriendCard, PendingRequestCard, BlockedUserCard } from '../components/social/FriendCard';
import AddFriendModal from '../components/social/AddFriendModal';
import { formatDistanceToNowShort } from '../lib/dateUtils';
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

type Tab = 'friends' | 'pending' | 'sent' | 'messages' | 'blocked' | 'team_invites';

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

export default function FriendsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const tab = searchParams.get('tab');
    if (tab === 'messages' || tab === 'pending' || tab === 'sent' || tab === 'blocked' || tab === 'team_invites') return tab;
    return 'friends';
  });
  const [showAddModal, setShowAddModal] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Team invites state
  const [teamInvites, setTeamInvites] = useState<PendingTeamInvite[]>([]);
  const [teamInvitesLoading, setTeamInvitesLoading] = useState(false);
  const [respondingInviteId, setRespondingInviteId] = useState<string | null>(null);

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
    loadConversations,
    setActiveConversation,
    sendMessage,
    subscribeToMessages,
  } = useMessagesStore();

  // Get user ID from URL param for messages
  const urlUserId = searchParams.get('user');

  useEffect(() => {
    if (user) {
      loadFriends();
      loadConversations();
      const unsubFriends = subscribeToRealtime(user.id);
      const unsubMessages = subscribeToMessages(user.id);
      return () => {
        unsubFriends();
        unsubMessages();
      };
    }
  }, [user, loadFriends, loadConversations, subscribeToRealtime, subscribeToMessages]);

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

  // Handle tab from URL
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'messages' || tab === 'pending' || tab === 'sent' || tab === 'blocked' || tab === 'team_invites') {
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
    setRespondingInviteId(inviteId);
    try {
      const result = await teamMembershipService.respondToTeamInvite(inviteId, accept);
      if (result.success) {
        setTeamInvites(teamInvites.filter(i => i.inviteId !== inviteId));
      }
    } catch (err) {
      console.error('Failed to respond to invite:', err);
    } finally {
      setRespondingInviteId(null);
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
    { id: 'friends', label: 'Friends', count: friends.length },
    { id: 'messages', label: 'Messages', count: unreadMessagesCount },
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

    setIsSending(true);
    const result = await sendMessage(activeConversation, newMessage.trim());

    if (result.success) {
      setNewMessage('');
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Friends</h1>
          <p className="text-gray-400 text-sm mt-1">
            Manage your friends, messages, and requests
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-lol-gold hover:bg-lol-gold-light text-lol-dark font-medium rounded-lg transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
          Add Friend
        </button>
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
              {friends.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="w-12 h-12 text-gray-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <p className="text-gray-400">No friends yet</p>
                  <p className="text-gray-500 text-sm mt-1">Add friends to collaborate on teams</p>
                </div>
              ) : (
                friends.map((friend) => (
                  <FriendCard
                    key={friend.friendshipId}
                    friend={friend}
                    onRemove={() => removeFriend(friend.friendshipId)}
                    onMessage={() => handleMessage(friend.friendId)}
                    onBlock={() => blockUser(friend.friendId)}
                  />
                ))
              )}
            </div>
          )}

          {/* Messages Tab */}
          {activeTab === 'messages' && (
            <div className="flex h-[calc(100vh-16rem)] bg-lol-card rounded-xl border border-lol-border overflow-hidden">
              {/* Conversation List */}
              <div className="w-72 shrink-0 border-r border-lol-border flex flex-col">
                <div className="p-3 border-b border-lol-border">
                  <h3 className="text-sm font-medium text-gray-400">Conversations</h3>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {messagesLoading ? (
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
