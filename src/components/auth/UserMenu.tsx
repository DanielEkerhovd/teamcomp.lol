import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/useAuthStore';
import LoginModal from './LoginModal';

interface UserMenuProps {
  collapsed: boolean;
}

export default function UserMenu({ collapsed }: UserMenuProps) {
  const navigate = useNavigate();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const { user, profile, isLoading, signOut } = useAuthStore();

  const isAuthenticated = !!user;

  const handleSignOut = async () => {
    await signOut();
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
                  onClick={() => {
                    navigate('/profile');
                    setShowDropdown(false);
                  }}
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
  const initials = displayName.slice(0, 2).toUpperCase();

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
        {profile?.avatarUrl ? (
          <img
            src={profile.avatarUrl}
            alt={displayName}
            className="size-9 shrink-0 rounded-lg object-cover"
          />
        ) : (
          <div className="size-9 shrink-0 rounded-lg bg-gradient-to-br from-lol-gold to-lol-gold-light flex items-center justify-center text-lol-dark font-semibold text-sm">
            {initials}
          </div>
        )}
        <div className={`min-w-0 text-left transition-all duration-300 overflow-hidden ${collapsed ? 'max-w-0 opacity-0 ml-0' : 'max-w-[200px] opacity-100 ml-3'}`}>
          <div className="text-sm font-medium text-white truncate">{displayName}</div>
          <div className={`text-xs leading-tight line-clamp-2 ${subtitleColor}`}>{subtitleText}</div>
        </div>
        {collapsed && (
          <div className="absolute left-full ml-3 px-3 py-2 bg-lol-card border border-lol-border rounded-lg text-sm text-white whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 shadow-xl z-50">
            {displayName}
          </div>
        )}
      </button>

      {/* Dropdown Menu */}
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
                onClick={() => {
                  navigate('/profile');
                  setShowDropdown(false);
                }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-lol-surface rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Settings
              </button>

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
        </>
      )}
    </div>
  );
}
