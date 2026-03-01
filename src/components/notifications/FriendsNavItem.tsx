import { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useFriendsStore } from '../../stores/useFriendsStore';
import { useMessagesStore } from '../../stores/useMessagesStore';
import { useAuthStore } from '../../stores/useAuthStore';

interface FriendsNavItemProps {
  collapsed?: boolean;
}

export default function FriendsNavItem({ collapsed }: FriendsNavItemProps) {
  const { user } = useAuthStore();
  const { pendingReceived, loadFriends, subscribeToRealtime } = useFriendsStore();
  const { conversations, loadConversations, subscribeToMessages } = useMessagesStore();

  // Calculate unread messages count
  const unreadMessagesCount = conversations.reduce((acc, c) => acc + c.unreadCount, 0);
  const pendingRequestsCount = pendingReceived.length;
  const totalUnread = unreadMessagesCount + pendingRequestsCount;

  // Load friends and messages when authenticated
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

  // Don't render for guests
  if (!user) return null;

  return (
    <NavLink
      to="/social"
      className={({ isActive }) =>
        `relative flex items-center py-3 px-3 rounded-xl font-medium transition-all duration-300 group ${
          isActive
            ? 'bg-gradient-to-r from-lol-gold/20 to-transparent text-lol-gold'
            : 'text-gray-400 hover:text-white hover:bg-lol-surface'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {/* Active indicator */}
          {isActive && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-lol-gold rounded-r-full" />
          )}

          {/* Friends Icon */}
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
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>

            {/* Unread Badge */}
            {totalUnread > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-bold text-white bg-red-500 rounded-full">
                {totalUnread > 99 ? '99+' : totalUnread}
              </span>
            )}
          </span>

          <span className={`whitespace-nowrap transition-all duration-300 overflow-hidden ${collapsed ? 'max-w-0 opacity-0 ml-0' : 'max-w-[200px] opacity-100 ml-3'}`}>
            Social
          </span>

          {/* Tooltip when collapsed */}
          {collapsed && (
            <div className="absolute left-full ml-3 px-3 py-2 bg-lol-card border border-lol-border rounded-lg text-sm text-white whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 shadow-xl z-50">
              Social
              {totalUnread > 0 && (
                <span className="ml-2 px-1.5 py-0.5 text-xs font-bold text-white bg-red-500 rounded-full">
                  {totalUnread}
                </span>
              )}
            </div>
          )}
        </>
      )}
    </NavLink>
  );
}
