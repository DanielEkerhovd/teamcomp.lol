import { useState } from 'react';
import { useAuthStore } from '../../stores/useAuthStore';
import { useAuthContext } from '../../contexts/AuthContext';
import LoginModal from './LoginModal';

interface UserMenuProps {
  collapsed: boolean;
}

export default function UserMenu({ collapsed }: UserMenuProps) {
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const { user, profile, isLoading, signOut } = useAuthStore();
  const { isConfigured } = useAuthContext();

  const isAuthenticated = !!user;

  const handleSignOut = async () => {
    await signOut();
    setShowDropdown(false);
  };

  // Guest user display
  if (!isAuthenticated) {
    return (
      <>
        <button
          onClick={() => setShowLoginModal(true)}
          className="flex items-center gap-3 w-full px-3 py-3 rounded-xl bg-lol-surface/50 border border-lol-border hover:border-lol-gold/50 transition-all duration-200 group relative"
        >
          <div className="w-9 h-9 shrink-0 rounded-lg bg-gradient-to-br from-gray-600 to-gray-700 flex items-center justify-center text-white font-semibold text-sm">
            ?
          </div>
          <div className={`flex-1 min-w-0 text-left transition-all duration-300 ${collapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>
            <div className="text-sm font-medium text-white truncate">Guest User</div>
            <div className="text-xs text-lol-gold">Click to sign in</div>
          </div>
          {collapsed && (
            <div className="absolute left-full ml-3 px-3 py-2 bg-lol-card border border-lol-border rounded-lg text-sm text-white whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 shadow-xl z-50">
              Sign in
            </div>
          )}
        </button>
        <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
      </>
    );
  }

  // Authenticated user display
  const displayName = profile?.displayName || user.email?.split('@')[0] || 'User';
  const initials = displayName.slice(0, 2).toUpperCase();
  const tierBadge = profile?.tier === 'paid' ? 'Pro' : profile?.tier === 'admin' ? 'Admin' : 'Free';
  const tierColor = profile?.tier === 'paid' ? 'text-lol-gold' : profile?.tier === 'admin' ? 'text-purple-400' : 'text-gray-400';

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center gap-3 w-full px-3 py-3 rounded-xl bg-lol-surface/50 border border-lol-border hover:border-lol-gold/50 transition-all duration-200 group"
      >
        {profile?.avatarUrl ? (
          <img
            src={profile.avatarUrl}
            alt={displayName}
            className="w-9 h-9 shrink-0 rounded-lg object-cover"
          />
        ) : (
          <div className="w-9 h-9 shrink-0 rounded-lg bg-gradient-to-br from-lol-gold to-lol-gold-light flex items-center justify-center text-lol-dark font-semibold text-sm">
            {initials}
          </div>
        )}
        <div className={`flex-1 min-w-0 text-left transition-all duration-300 ${collapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>
          <div className="text-sm font-medium text-white truncate">{displayName}</div>
          <div className={`text-xs ${tierColor}`}>{tierBadge}</div>
        </div>
        {!collapsed && (
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${showDropdown ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
        {collapsed && (
          <div className="absolute left-full ml-3 px-3 py-2 bg-lol-card border border-lol-border rounded-lg text-sm text-white whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 shadow-xl z-50">
            {displayName}
          </div>
        )}
      </button>

      {/* Dropdown Menu */}
      {showDropdown && !collapsed && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowDropdown(false)}
          />

          {/* Menu */}
          <div className="absolute bottom-full left-0 right-0 mb-2 bg-lol-card border border-lol-border rounded-xl shadow-xl z-50 overflow-hidden">
            <div className="p-3 border-b border-lol-border">
              <div className="text-sm text-white font-medium truncate">{user.email}</div>
              <div className="text-xs text-gray-400 mt-0.5">
                {profile?.maxTeams ?? 1} team{(profile?.maxTeams ?? 1) !== 1 ? 's' : ''} allowed
              </div>
            </div>

            <div className="p-1">
              {profile?.tier === 'free' && (
                <button
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-lol-gold hover:bg-lol-surface rounded-lg transition-colors"
                  onClick={() => {
                    // TODO: Implement upgrade flow
                    setShowDropdown(false);
                  }}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                  Upgrade to Pro
                </button>
              )}

              <button
                onClick={handleSignOut}
                disabled={isLoading}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-lol-surface rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                {isLoading ? 'Signing out...' : 'Sign Out'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
