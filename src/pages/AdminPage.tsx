import { useState, useCallback, useEffect, useRef } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuthStore } from '../stores/useAuthStore';
import { supabase } from '../lib/supabase';
import type { UserTier, ProfileRole } from '../types/database';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import { TeamOnboardingContent } from '../components/onboarding/TeamOnboardingModal';
import AnalyticsDashboard from '../components/admin/AnalyticsDashboard';
import TierDowngradeModal from '../components/downgrade/TierDowngradeModal';

interface AdminUser {
  id: string;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
  tier: UserTier;
  role: ProfileRole | null;
  role_team_name: string | null;
  tier_expires_at: string | null;
  banned_at: string | null;
  ban_reason: string | null;
  created_at: string;
}

const ALL_TIERS: UserTier[] = ['free', 'beta', 'paid', 'supporter', 'admin', 'developer'];

const TIER_COLORS: Record<UserTier, string> = {
  free: 'bg-gray-500/20 text-gray-400',
  beta: 'bg-blue-500/20 text-blue-400',
  paid: 'bg-yellow-500/20 text-lol-gold',
  supporter: 'bg-pink-500/20 text-pink-400',
  admin: 'bg-purple-500/20 text-purple-400',
  developer: 'bg-emerald-500/20 text-emerald-400',
};

const formatRole = (role: string) =>
  role.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

export default function AdminPage() {
  const { profile } = useAuthStore();

  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Expanded user management state
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [tierMessage, setTierMessage] = useState('');

  // Change tier modal
  const [changeTierTarget, setChangeTierTarget] = useState<AdminUser | null>(null);
  const [newTier, setNewTier] = useState<UserTier>('free');
  const [tierExpiry, setTierExpiry] = useState('');
  const [tierDuration, setTierDuration] = useState<'permanent' | 'timed'>('permanent');
  const [tierLoading, setTierLoading] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Avatar moderation
  const [avatarModTarget, setAvatarModTarget] = useState<AdminUser | null>(null);
  const [avatarModMessage, setAvatarModMessage] = useState('Your avatar has been removed for violating our guidelines.');
  const [avatarModLoading, setAvatarModLoading] = useState(false);

  // Ban management
  const [banTarget, setBanTarget] = useState<AdminUser | null>(null);
  const [banReason, setBanReason] = useState('');
  const [banLoading, setBanLoading] = useState(false);
  const [unbanLoading, setUnbanLoading] = useState(false);

  // Test onboarding
  const [showTestOnboarding, setShowTestOnboarding] = useState(false);

  // Analytics
  const [analyticsOpen, setAnalyticsOpen] = useState(false);

  // Test downgrade modal
  const [showTestDowngrade, setShowTestDowngrade] = useState(false);

  const handleSearch = useCallback(async (searchQuery: string) => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setUsers([]);
      return;
    }

    setSearching(true);
    setSearchError('');

    const { data, error } = await supabase.rpc('admin_search_users', {
      search_query: trimmed,
    });

    if (error) {
      setSearchError(error.message);
      setUsers([]);
    } else {
      setUsers((data as AdminUser[]) ?? []);
    }
    setSearching(false);
  }, []);

  // Debounced auto-search on typing
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim()) {
      setUsers([]);
      setSearchError('');
      return;
    }

    debounceRef.current = setTimeout(() => {
      handleSearch(query);
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, handleSearch]);

  // Guard: developer only
  if (profile?.tier !== 'developer') {
    return <Navigate to="/" replace />;
  }

  const selectUser = (user: AdminUser) => {
    if (selectedUser?.id === user.id) {
      setSelectedUser(null);
    } else {
      setSelectedUser(user);
      setTierMessage('');
    }
  };

  const openChangeTierModal = (user: AdminUser) => {
    setChangeTierTarget(user);
    setNewTier(user.tier);
    setTierDuration('permanent');
    const now = new Date();
    now.setMinutes(0, 0, 0);
    const pad = (n: number) => String(n).padStart(2, '0');
    setTierExpiry(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours() + 1)}:00`);
    setTierMessage('');
  };

  const handleSetTier = async () => {
    if (!changeTierTarget) return;
    setTierLoading(true);
    setTierMessage('');

    let hours: number | null = null;
    if (tierDuration === 'timed') {
      if (!tierExpiry) {
        setTierMessage('Please select an expiry date');
        setTierLoading(false);
        return;
      }
      const expiryDate = new Date(tierExpiry);
      const now = new Date();
      const diffMs = expiryDate.getTime() - now.getTime();
      if (diffMs <= 0) {
        setTierMessage('Expiry date must be in the future');
        setTierLoading(false);
        return;
      }
      hours = Math.ceil(diffMs / 3600000);
    }

    const { data, error } = await supabase.rpc('admin_set_user_tier', {
      target_user_id: changeTierTarget.id,
      new_tier: newTier,
      expires_in_hours: hours,
    });

    if (error) {
      setTierMessage(error.message);
    } else {
      const result = data as { success: boolean; message?: string };
      if (result.success) {
        setTierMessage('Tier updated successfully');
        const newExpiry = tierExpiry ? new Date(tierExpiry).toISOString() : null;
        setUsers(prev =>
          prev.map(u =>
            u.id === changeTierTarget.id
              ? { ...u, tier: newTier, tier_expires_at: newExpiry }
              : u
          )
        );
        if (selectedUser?.id === changeTierTarget.id) {
          setSelectedUser(prev =>
            prev ? { ...prev, tier: newTier, tier_expires_at: newExpiry } : null
          );
        }
        setChangeTierTarget(null);
      } else {
        setTierMessage(result.message ?? 'Failed');
      }
    }
    setTierLoading(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);

    const { data, error } = await supabase.rpc('admin_delete_user', {
      target_user_id: deleteTarget.id,
    });

    if (error) {
      setTierMessage(error.message);
    } else {
      const result = data as { success: boolean; message?: string };
      if (result.success) {
        setUsers(prev => prev.filter(u => u.id !== deleteTarget.id));
        if (selectedUser?.id === deleteTarget.id) setSelectedUser(null);
      } else {
        setTierMessage(result.message ?? 'Failed to delete');
      }
    }
    setDeleteTarget(null);
    setDeleteLoading(false);
  };

  const handleRemoveAvatar = async () => {
    if (!avatarModTarget) return;
    setAvatarModLoading(true);

    const { data, error } = await supabase.rpc('admin_remove_user_avatar', {
      target_user_id: avatarModTarget.id,
      moderation_message: avatarModMessage.trim() || 'Your avatar has been removed for violating our guidelines.',
    });

    if (error) {
      setTierMessage(error.message);
    } else {
      const result = data as { success: boolean; message?: string };
      if (result.success) {
        setTierMessage('Avatar removed successfully. User notified.');
        setUsers(prev =>
          prev.map(u =>
            u.id === avatarModTarget.id ? { ...u, avatar_url: null } : u
          )
        );
        if (selectedUser?.id === avatarModTarget.id) {
          setSelectedUser(prev => prev ? { ...prev, avatar_url: null } : null);
        }
      } else {
        setTierMessage(result.message ?? 'Failed to remove avatar');
      }
    }
    setAvatarModTarget(null);
    setAvatarModLoading(false);
    setAvatarModMessage('Your avatar has been removed for violating our guidelines.');
  };

  const handleBan = async () => {
    if (!banTarget) return;
    setBanLoading(true);

    const { data, error } = await supabase.rpc('admin_ban_user', {
      target_user_id: banTarget.id,
      p_reason: banReason.trim() || 'Banned by administrator',
    });

    if (error) {
      setTierMessage(error.message);
    } else {
      const result = data as { success: boolean; message?: string };
      if (result.success) {
        setTierMessage('User banned successfully');
        const now = new Date().toISOString();
        const reason = banReason.trim() || 'Banned by administrator';
        setUsers(prev => prev.map(u =>
          u.id === banTarget.id ? { ...u, banned_at: now, ban_reason: reason } : u
        ));
        if (selectedUser?.id === banTarget.id) {
          setSelectedUser(prev => prev ? { ...prev, banned_at: now, ban_reason: reason } : null);
        }
      } else {
        setTierMessage(result.message ?? 'Failed to ban');
      }
    }
    setBanTarget(null);
    setBanLoading(false);
    setBanReason('');
  };

  const handleUnban = async (userId: string) => {
    setUnbanLoading(true);

    const { data, error } = await supabase.rpc('admin_unban_user', {
      target_user_id: userId,
    });

    if (error) {
      setTierMessage(error.message);
    } else {
      const result = data as { success: boolean; message?: string };
      if (result.success) {
        setTierMessage('User unbanned successfully');
        setUsers(prev => prev.map(u =>
          u.id === userId ? { ...u, banned_at: null, ban_reason: null } : u
        ));
        if (selectedUser?.id === userId) {
          setSelectedUser(prev => prev ? { ...prev, banned_at: null, ban_reason: null } : null);
        }
      } else {
        setTierMessage(result.message ?? 'Failed to unban');
      }
    }
    setUnbanLoading(false);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatExpiry = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = d.getTime() - now.getTime();
    if (diffMs <= 0) return 'Expired';
    const hours = Math.floor(diffMs / 3600000);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ${hours % 24}h remaining`;
    return `${hours}h remaining`;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
        <p className="text-sm text-gray-400 mt-1">
          Search and manage users. Developer access only.
        </p>
      </div>

      {/* Quick links & tools */}
      <div className="flex items-center gap-3">
        <Link
          to="/splasharts"
          className="flex items-center gap-2 px-4 py-2 bg-lol-surface hover:bg-lol-card-hover border border-lol-border rounded-xl text-sm text-gray-300 hover:text-white transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Manage Splashart rotation
        </Link>
        <button
          onClick={() => setShowTestOnboarding(true)}
          className="flex items-center gap-2 px-4 py-2 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded-xl text-sm text-purple-400 hover:text-purple-300 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          Test Onboarding
        </button>
        <button
          onClick={() => setShowTestDowngrade(true)}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 rounded-xl text-sm text-orange-400 hover:text-orange-300 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
          </svg>
          Test Downgrade
        </button>
      </div>

      {/* Test onboarding modal */}
      {showTestOnboarding && (
        <TeamOnboardingContent testMode onClose={() => setShowTestOnboarding(false)} />
      )}

      {/* Analytics (collapsed by default) */}
      <button
        onClick={() => setAnalyticsOpen(!analyticsOpen)}
        className="w-full flex items-center justify-between px-5 py-4 bg-lol-card border border-lol-border rounded-2xl hover:bg-lol-card-hover transition-colors group"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-lol-gold/10 flex items-center justify-center">
            <svg className="w-5 h-5 text-lol-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div className="text-left">
            <h2 className="text-sm font-semibold text-white">Analytics</h2>
            <p className="text-xs text-gray-500">Page views and visitor metrics</p>
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-gray-500 group-hover:text-gray-300 transition-transform ${analyticsOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {analyticsOpen && <AnalyticsDashboard />}

      {/* Moderating */}
      <div>
        <h2 className="text-lg font-semibold text-white">Moderating</h2>
        <p className="text-sm text-gray-400 mt-0.5">Search and manage user accounts, tiers, and bans.</p>
      </div>
      <div className="relative">
        <Input
          placeholder="Search by display name or user ID..."
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        {searching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-lol-gold/30 border-t-lol-gold rounded-full animate-spin" />
          </div>
        )}
      </div>

      {searchError && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          {searchError}
        </div>
      )}

      {/* Results */}
      {users.length > 0 && (
        <div className="border border-lol-border rounded-2xl overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_120px_100px_40px] gap-4 px-5 py-3 bg-lol-surface/50 border-b border-lol-border text-xs uppercase tracking-wider text-gray-500 font-medium">
            <span>User</span>
            <span>Tier</span>
            <span>Joined</span>
            <span />
          </div>

          {/* Rows */}
          {users.map(user => (
            <div key={user.id}>
              <button
                onClick={() => selectUser(user)}
                className={`w-full grid grid-cols-[1fr_120px_100px_40px] gap-4 px-5 py-3 text-left transition-colors hover:bg-lol-surface/30 ${
                  selectedUser?.id === user.id
                    ? 'bg-lol-surface/50 border-l-2 border-l-lol-gold'
                    : 'border-l-2 border-l-transparent'
                }`}
              >
                {/* User info with avatar */}
                <div className="flex items-center gap-3 min-w-0">
                  {user.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt={user.display_name || 'User'}
                      className="w-9 h-9 rounded-lg object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-gray-600 to-gray-700 flex items-center justify-center text-white font-semibold text-xs shrink-0">
                      {(user.display_name || '?').slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-white truncate">
                      {user.display_name || 'No name'}
                    </div>
                    {user.role ? (
                      <div className="text-xs text-lol-gold truncate">
                        {formatRole(user.role)}{user.role_team_name ? ` for ${user.role_team_name}` : ''}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-500 truncate font-mono">
                        {user.id.slice(0, 8)}...
                      </div>
                    )}
                  </div>
                </div>

                {/* Tier badge */}
                <div className="flex items-center">
                  <span
                    className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold ${TIER_COLORS[user.tier]}`}
                  >
                    {user.tier}
                  </span>
                </div>

                {/* Joined */}
                <div className="flex items-center text-xs text-gray-400">
                  {formatDate(user.created_at)}
                </div>

                {/* Expand indicator */}
                <div className="flex items-center justify-end">
                  <svg
                    className={`w-4 h-4 text-gray-500 transition-transform ${
                      selectedUser?.id === user.id ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              </button>

              {/* Expanded detail panel */}
              {selectedUser?.id === user.id && (
                <div className="px-5 py-4 bg-lol-dark/50 border-t border-lol-border space-y-4">
                  {/* Info row */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Email:</span>{' '}
                      <span className="text-gray-300">
                        {user.email || 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">ID:</span>{' '}
                      <span className="text-gray-300 font-mono text-xs">
                        {user.id}
                      </span>
                    </div>
                    {user.role && (
                      <div>
                        <span className="text-gray-500">Role:</span>{' '}
                        <span className="text-lol-gold">
                          {formatRole(user.role)}{user.role_team_name ? ` for ${user.role_team_name}` : ''}
                        </span>
                      </div>
                    )}
                    {user.tier_expires_at && (
                      <div>
                        <span className="text-gray-500">Tier expires:</span>{' '}
                        <span className="text-yellow-400">
                          {formatExpiry(user.tier_expires_at)}
                        </span>
                      </div>
                    )}
                    {user.banned_at && (
                      <div>
                        <span className="text-gray-500">Banned:</span>{' '}
                        <span className="text-red-400">
                          {formatDate(user.banned_at)}
                          {user.ban_reason && ` - ${user.ban_reason}`}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3">
                    <Button
                      size="sm"
                      onClick={() => openChangeTierModal(user)}
                    >
                      Change Tier
                    </Button>

                    <div className="ml-auto flex gap-2">
                      {user.banned_at ? (
                        <Button
                          size="sm"
                          onClick={() => handleUnban(user.id)}
                          disabled={unbanLoading || user.tier === 'developer'}
                        >
                          {unbanLoading ? 'Unbanning...' : 'Unban'}
                        </Button>
                      ) : (
                        user.tier !== 'developer' && (
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => setBanTarget(user)}
                          >
                            Ban User
                          </Button>
                        )
                      )}
                      {user.avatar_url && user.tier !== 'developer' && (
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => setAvatarModTarget(user)}
                        >
                          Remove Avatar
                        </Button>
                      )}
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => setDeleteTarget(user)}
                        disabled={user.tier === 'developer'}
                      >
                        Delete User
                      </Button>
                    </div>
                  </div>

                  {/* Status message */}
                  {tierMessage && (
                    <div
                      className={`text-sm px-3 py-2 rounded-lg ${
                        tierMessage.includes('success')
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-red-500/10 text-red-400'
                      }`}
                    >
                      {tierMessage}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!searching && users.length === 0 && query.trim() && !searchError && (
        <div className="text-center py-12 text-gray-500">
          No users found. Try a different search term.
        </div>
      )}

      {/* Delete confirmation modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete User"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-300">
            Are you sure you want to permanently delete{' '}
            <span className="font-semibold text-white">
              {deleteTarget?.display_name || deleteTarget?.id}
            </span>
            ? This will remove their profile and all associated data. This
            action cannot be undone.
          </p>
          <div className="flex gap-3 justify-end">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleDelete}
              disabled={deleteLoading}
            >
              {deleteLoading ? 'Deleting...' : 'Delete Permanently'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Avatar moderation modal */}
      <Modal
        isOpen={!!avatarModTarget}
        onClose={() => setAvatarModTarget(null)}
        title="Remove User Avatar"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-300">
            Remove the avatar for{' '}
            <span className="font-semibold text-white">
              {avatarModTarget?.display_name || avatarModTarget?.id}
            </span>
            ? They will be unable to set a new avatar for 1 month.
          </p>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-gray-400">
              Message to user (sent as notification)
            </label>
            <textarea
              value={avatarModMessage}
              onChange={e => setAvatarModMessage(e.target.value)}
              rows={3}
              className="bg-lol-dark border border-lol-border rounded-xl px-3 py-2 text-sm text-white focus:border-lol-gold/50 focus:outline-none focus:ring-2 focus:ring-lol-gold/20 resize-none"
              placeholder="Reason for avatar removal..."
            />
          </div>

          <div className="flex gap-3 justify-end">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setAvatarModTarget(null)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleRemoveAvatar}
              disabled={avatarModLoading}
            >
              {avatarModLoading ? 'Removing...' : 'Remove Avatar'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Change tier modal */}
      <Modal
        isOpen={!!changeTierTarget}
        onClose={() => setChangeTierTarget(null)}
        title="Change Tier"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400">User:</span>
            <span className="text-sm font-medium text-white">
              {changeTierTarget?.display_name || changeTierTarget?.id}
            </span>
            <span className={`inline-flex px-2 py-0.5 rounded-lg text-xs font-semibold ${TIER_COLORS[changeTierTarget?.tier ?? 'free']}`}>
              {changeTierTarget?.tier}
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-gray-400">
              New Tier
            </label>
            <select
              value={newTier}
              onChange={e => setNewTier(e.target.value as UserTier)}
              className="bg-lol-dark border border-lol-border rounded-xl px-3 py-2 text-sm text-white focus:border-lol-gold/50 focus:outline-none focus:ring-2 focus:ring-lol-gold/20"
            >
              {ALL_TIERS.map(t => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-gray-400">
              Duration
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => { setTierDuration('permanent'); setTierExpiry(''); }}
                className={`flex flex-col items-center gap-1 px-3 py-3 rounded-xl border text-sm font-medium transition-all ${
                  tierDuration === 'permanent'
                    ? 'border-lol-gold bg-lol-gold/10 text-lol-gold'
                    : 'border-lol-border bg-lol-dark text-gray-400 hover:border-gray-500'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18.178 8c5.096 0 5.096 8 0 8-5.095 0-7.133-8-12.739-8-4.585 0-4.585 8 0 8 5.606 0 7.644-8 12.739-8z"/></svg>
                Permanent
              </button>
              <button
                type="button"
                onClick={() => setTierDuration('timed')}
                className={`flex flex-col items-center gap-1 px-3 py-3 rounded-xl border text-sm font-medium transition-all ${
                  tierDuration === 'timed'
                    ? 'border-lol-gold bg-lol-gold/10 text-lol-gold'
                    : 'border-lol-border bg-lol-dark text-gray-400 hover:border-gray-500'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                Timed
              </button>
            </div>
            {tierDuration === 'timed' && (
              <input
                type="datetime-local"
                value={tierExpiry}
                onChange={e => setTierExpiry(e.target.value)}
                min={(() => {
                  const now = new Date();
                  now.setMinutes(0, 0, 0);
                  const pad = (n: number) => String(n).padStart(2, '0');
                  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:00`;
                })()}
                step="3600"
                className="bg-lol-dark border border-lol-border rounded-xl px-3 py-2 text-sm text-white focus:border-lol-gold/50 focus:outline-none focus:ring-2 focus:ring-lol-gold/20 scheme-dark mt-1"
              />
            )}
          </div>

          {tierMessage && (
            <div
              className={`text-sm px-3 py-2 rounded-lg ${
                tierMessage.includes('success')
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-red-500/10 text-red-400'
              }`}
            >
              {tierMessage}
            </div>
          )}

          <div className="flex gap-3 justify-end">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setChangeTierTarget(null)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSetTier}
              disabled={tierLoading}
            >
              {tierLoading ? 'Saving...' : 'Apply'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Ban confirmation modal */}
      <Modal
        isOpen={!!banTarget}
        onClose={() => setBanTarget(null)}
        title="Ban User"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-300">
            Ban{' '}
            <span className="font-semibold text-white">
              {banTarget?.display_name || banTarget?.id}
            </span>
            ? They will be unable to use the app until unbanned.
          </p>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-gray-400">
              Reason (sent as notification)
            </label>
            <textarea
              value={banReason}
              onChange={e => setBanReason(e.target.value)}
              rows={2}
              className="bg-lol-dark border border-lol-border rounded-xl px-3 py-2 text-sm text-white resize-none focus:border-lol-gold/50 focus:outline-none focus:ring-2 focus:ring-lol-gold/20"
              placeholder="Reason for ban..."
            />
          </div>

          <div className="flex gap-3 justify-end">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setBanTarget(null)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleBan}
              disabled={banLoading}
            >
              {banLoading ? 'Banning...' : 'Confirm Ban'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Test downgrade modal (no-op handlers, mock data) */}
      <TierDowngradeModal
        testMode
        isOpen={showTestDowngrade}
        downgradedAt={new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()}
        contentData={{
          myTeams: [
            { id: 'mock-t1', name: 'Cloud9 Academy', updatedAt: new Date().toISOString(), playerCount: 5, playerNames: ['Player1', 'Player2', 'Player3', 'Player4', 'Player5'] },
            { id: 'mock-t2', name: 'TSM Blue', updatedAt: new Date(Date.now() - 86400000).toISOString(), playerCount: 5, playerNames: ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo'] },
            { id: 'mock-t3', name: 'Old Scrim Team', updatedAt: new Date(Date.now() - 7 * 86400000).toISOString(), playerCount: 3, playerNames: ['Foxtrot', 'Golf', 'Hotel'] },
          ],
          enemyTeams: Array.from({ length: 15 }, (_, i) => ({
            id: `mock-e${i + 1}`,
            name: `Enemy Team ${i + 1}`,
            updatedAt: new Date(Date.now() - i * 86400000).toISOString(),
            playerCount: 5,
            playerNames: [`E${i + 1}P1`, `E${i + 1}P2`, `E${i + 1}P3`, `E${i + 1}P4`, `E${i + 1}P5`],
          })),
          drafts: Array.from({ length: 25 }, (_, i) => ({
            id: `mock-d${i + 1}`,
            name: `Draft Session ${i + 1}`,
            updatedAt: new Date(Date.now() - i * 3600000).toISOString(),
          })),
        }}
        onConfirm={async () => { setShowTestDowngrade(false); }}
        onResubscribed={() => { setShowTestDowngrade(false); }}
      />
    </div>
  );
}
