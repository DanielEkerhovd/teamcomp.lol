import { useState, useCallback, useEffect, useRef } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuthStore } from '../stores/useAuthStore';
import { useAdminSessionStore } from '../stores/useAdminSessionStore';
import { supabase } from '../lib/supabase';
import type { UserTier, ProfileRole } from '../types/database';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import { TeamOnboardingContent } from '../components/onboarding/TeamOnboardingModal';
import AnalyticsDashboard from '../components/admin/AnalyticsDashboard';
import PlatformStats from '../components/admin/PlatformStats';
import TeamPlanDemo from '../components/admin/TeamPlanDemo';
import TierDowngradeModal from '../components/downgrade/TierDowngradeModal';
import AdminPinGate from '../components/admin/AdminPinGate';
import AdminPinChange from '../components/admin/AdminPinChange';

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

interface AdminTeam {
  id: string;
  name: string;
  owner_id: string;
  owner_display_name: string | null;
  owner_avatar_url: string | null;
  has_team_plan: boolean;
  team_plan_status: string | null;
  team_max_enemy_teams: number;
  member_count: number;
  banned_at: string | null;
  ban_reason: string | null;
  ban_expires_at: string | null;
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
  const { expiresAt, lockSession } = useAdminSessionStore();
  const [showPinChange, setShowPinChange] = useState(false);

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

  // Warning management
  const [warnTarget, setWarnTarget] = useState<AdminUser | null>(null);
  const [warnMessage, setWarnMessage] = useState('');
  const [warnNextConsequence, setWarnNextConsequence] = useState('temporary_ban');
  const [warnCategory, setWarnCategory] = useState('');
  const [warnLoading, setWarnLoading] = useState(false);
  const [warningCounts, setWarningCounts] = useState<Record<string, number>>({});

  // Test onboarding
  const [showTestOnboarding, setShowTestOnboarding] = useState(false);

  // Analytics
  const [analyticsOpen, setAnalyticsOpen] = useState(false);

  // Platform Stats
  const [platformStatsOpen, setPlatformStatsOpen] = useState(false);

  // Team Plan Demo
  const [teamPlanDemoOpen, setTeamPlanDemoOpen] = useState(false);

  // Test downgrade modal
  const [showTestDowngrade, setShowTestDowngrade] = useState(false);
  const [testDowngradeReason, setTestDowngradeReason] = useState<'canceled' | 'payment_failed'>('canceled');

  // Team management
  const [teams, setTeams] = useState<AdminTeam[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<AdminTeam | null>(null);
  const [teamMessage, setTeamMessage] = useState('');
  const [revokeTarget, setRevokeTarget] = useState<AdminTeam | null>(null);
  const [teamPlanLoading, setTeamPlanLoading] = useState(false);

  // Team rename
  const [renameTarget, setRenameTarget] = useState<AdminTeam | null>(null);
  const [newTeamName, setNewTeamName] = useState('');
  const [renameLoading, setRenameLoading] = useState(false);

  // Team delete
  const [deleteTeamTarget, setDeleteTeamTarget] = useState<AdminTeam | null>(null);
  const [deleteTeamMessage, setDeleteTeamMessage] = useState('Your team has been removed by an administrator.');
  const [deleteTeamLoading, setDeleteTeamLoading] = useState(false);

  // Team ban
  const [banTeamTarget, setBanTeamTarget] = useState<AdminTeam | null>(null);
  const [banTeamReason, setBanTeamReason] = useState('');
  const [banTeamDuration, setBanTeamDuration] = useState<'permanent' | 'timed'>('permanent');
  const [banTeamExpiry, setBanTeamExpiry] = useState('');
  const [banTeamLoading, setBanTeamLoading] = useState(false);
  const [unbanTeamLoading, setUnbanTeamLoading] = useState(false);

  const handleSearch = useCallback(async (searchQuery: string) => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setUsers([]);
      setTeams([]);
      return;
    }

    setSearching(true);
    setSearchError('');

    const [usersRes, teamsRes] = await Promise.all([
      supabase.rpc('admin_search_users', { search_query: trimmed }),
      supabase.rpc('admin_search_teams', { search_query: trimmed }),
    ]);

    if (usersRes.error) {
      setSearchError(usersRes.error.message);
      setUsers([]);
    } else {
      setUsers((usersRes.data as AdminUser[]) ?? []);
    }

    if (teamsRes.error) {
      setSearchError(e => e ? `${e}; ${teamsRes.error!.message}` : teamsRes.error!.message);
      setTeams([]);
    } else {
      setTeams((teamsRes.data as AdminTeam[]) ?? []);
    }

    setSearching(false);
  }, []);

  // Debounced auto-search on typing
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim()) {
      setUsers([]);
      setTeams([]);
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

  const fetchWarningCount = async (userId: string) => {
    if (warningCounts[userId] !== undefined) return;
    const { data } = await supabase.rpc('admin_get_warning_count', {
      target_user_id: userId,
    });
    if (typeof data === 'number') {
      setWarningCounts(prev => ({ ...prev, [userId]: data }));
    }
  };

  const handleWarn = async () => {
    if (!warnTarget) return;
    setWarnLoading(true);

    const { data, error } = await supabase.rpc('admin_warn_user', {
      target_user_id: warnTarget.id,
      p_message: warnMessage.trim() || 'You have received a warning from a moderator.',
      p_next_consequence: warnNextConsequence,
      p_category: warnCategory || undefined,
    });

    if (error) {
      setTierMessage(error.message);
    } else {
      const result = data as { success: boolean; message?: string; warning_count?: number };
      if (result.success) {
        setTierMessage('Warning sent successfully');
        if (result.warning_count) {
          setWarningCounts(prev => ({ ...prev, [warnTarget.id]: result.warning_count! }));
        }
      } else {
        setTierMessage(result.message ?? 'Failed to send warning');
      }
    }
    setWarnTarget(null);
    setWarnLoading(false);
    setWarnMessage('');
    setWarnNextConsequence('temporary_ban');
    setWarnCategory('');
  };

  const selectUser = (user: AdminUser) => {
    if (selectedUser?.id === user.id) {
      setSelectedUser(null);
    } else {
      setSelectedUser(user);
      setTierMessage('');
      fetchWarningCount(user.id);
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

  const selectTeam = (team: AdminTeam) => {
    if (selectedTeam?.id === team.id) {
      setSelectedTeam(null);
    } else {
      setSelectedTeam(team);
      setTeamMessage('');
    }
  };

  const handleSetTeamPlan = async (team: AdminTeam, enable: boolean) => {
    setTeamPlanLoading(true);
    setTeamMessage('');

    const { data, error } = await supabase.rpc('admin_set_team_plan', {
      target_team_id: team.id,
      enable,
    });

    if (error) {
      setTeamMessage(error.message);
    } else {
      const result = data as { success: boolean; message?: string };
      if (result.success) {
        setTeamMessage(enable ? 'Team plan granted successfully' : 'Team plan revoked successfully');
        setTeams(prev =>
          prev.map(t =>
            t.id === team.id
              ? {
                  ...t,
                  has_team_plan: enable,
                  team_plan_status: enable ? 'active' : null,
                  team_max_enemy_teams: enable ? 300 : 0,
                }
              : t
          )
        );
        if (selectedTeam?.id === team.id) {
          setSelectedTeam(prev =>
            prev
              ? {
                  ...prev,
                  has_team_plan: enable,
                  team_plan_status: enable ? 'active' : null,
                  team_max_enemy_teams: enable ? 300 : 0,
                }
              : null
          );
        }
        setRevokeTarget(null);
      } else {
        setTeamMessage(result.message ?? 'Failed');
      }
    }
    setTeamPlanLoading(false);
  };

  const handleRenameTeam = async () => {
    if (!renameTarget) return;
    setRenameLoading(true);
    setTeamMessage('');

    const { data, error } = await supabase.rpc('admin_rename_team', {
      target_team_id: renameTarget.id,
      new_name: newTeamName,
    });

    if (error) {
      setTeamMessage(error.message);
    } else {
      const result = data as { success: boolean; message?: string };
      if (result.success) {
        const trimmed = newTeamName.trim();
        setTeamMessage('Team renamed successfully');
        setTeams(prev => prev.map(t => t.id === renameTarget.id ? { ...t, name: trimmed } : t));
        if (selectedTeam?.id === renameTarget.id) {
          setSelectedTeam(prev => prev ? { ...prev, name: trimmed } : null);
        }
        setRenameTarget(null);
      } else {
        setTeamMessage(result.message ?? 'Failed to rename');
      }
    }
    setRenameLoading(false);
  };

  const handleDeleteTeam = async () => {
    if (!deleteTeamTarget) return;
    setDeleteTeamLoading(true);

    const { data, error } = await supabase.rpc('admin_delete_team', {
      target_team_id: deleteTeamTarget.id,
      p_message: deleteTeamMessage.trim() || 'Your team has been removed by an administrator.',
    });

    if (error) {
      setTeamMessage(error.message);
    } else {
      const result = data as { success: boolean; message?: string };
      if (result.success) {
        setTeams(prev => prev.filter(t => t.id !== deleteTeamTarget.id));
        if (selectedTeam?.id === deleteTeamTarget.id) setSelectedTeam(null);
        setTeamMessage(result.message ?? 'Team deleted');
      } else {
        setTeamMessage(result.message ?? 'Failed to delete team');
      }
    }
    setDeleteTeamTarget(null);
    setDeleteTeamLoading(false);
  };

  const handleBanTeam = async () => {
    if (!banTeamTarget) return;
    setBanTeamLoading(true);

    let hours: number | null = null;
    if (banTeamDuration === 'timed') {
      if (!banTeamExpiry) {
        setTeamMessage('Please select an expiry date');
        setBanTeamLoading(false);
        return;
      }
      const expiryDate = new Date(banTeamExpiry);
      const now = new Date();
      const diffMs = expiryDate.getTime() - now.getTime();
      if (diffMs <= 0) {
        setTeamMessage('Expiry date must be in the future');
        setBanTeamLoading(false);
        return;
      }
      hours = Math.ceil(diffMs / 3600000);
    }

    const { data, error } = await supabase.rpc('admin_ban_team', {
      target_team_id: banTeamTarget.id,
      p_reason: banTeamReason.trim() || 'Banned by administrator',
      ban_hours: hours,
    });

    if (error) {
      setTeamMessage(error.message);
    } else {
      const result = data as { success: boolean; message?: string };
      if (result.success) {
        setTeamMessage('Team banned successfully');
        const now = new Date().toISOString();
        const reason = banTeamReason.trim() || 'Banned by administrator';
        const expiresAt = banTeamExpiry ? new Date(banTeamExpiry).toISOString() : null;
        setTeams(prev => prev.map(t =>
          t.id === banTeamTarget.id ? { ...t, banned_at: now, ban_reason: reason, ban_expires_at: expiresAt } : t
        ));
        if (selectedTeam?.id === banTeamTarget.id) {
          setSelectedTeam(prev => prev ? { ...prev, banned_at: now, ban_reason: reason, ban_expires_at: expiresAt } : null);
        }
      } else {
        setTeamMessage(result.message ?? 'Failed to ban team');
      }
    }
    setBanTeamTarget(null);
    setBanTeamLoading(false);
    setBanTeamReason('');
    setBanTeamDuration('permanent');
    setBanTeamExpiry('');
  };

  const handleUnbanTeam = async (teamId: string) => {
    setUnbanTeamLoading(true);

    const { data, error } = await supabase.rpc('admin_unban_team', {
      target_team_id: teamId,
    });

    if (error) {
      setTeamMessage(error.message);
    } else {
      const result = data as { success: boolean; message?: string };
      if (result.success) {
        setTeamMessage('Team unbanned successfully');
        setTeams(prev => prev.map(t =>
          t.id === teamId ? { ...t, banned_at: null, ban_reason: null, ban_expires_at: null } : t
        ));
        if (selectedTeam?.id === teamId) {
          setSelectedTeam(prev => prev ? { ...prev, banned_at: null, ban_reason: null, ban_expires_at: null } : null);
        }
      } else {
        setTeamMessage(result.message ?? 'Failed to unban team');
      }
    }
    setUnbanTeamLoading(false);
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
    <AdminPinGate>
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header + Session Bar */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
          <p className="text-sm text-gray-400 mt-1">
            Search and manage users. Developer access only.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {expiresAt && (
            <AdminSessionTimer expiresAt={expiresAt} />
          )}
          <button
            onClick={() => setShowPinChange(true)}
            className="p-2 rounded-lg bg-lol-surface/50 border border-lol-border text-gray-400 hover:text-white hover:bg-lol-card-hover transition-colors"
            title="Change PIN"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" />
            </svg>
          </button>
          <button
            onClick={lockSession}
            className="p-2 rounded-lg bg-lol-surface/50 border border-lol-border text-gray-400 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/30 transition-colors"
            title="Lock admin panel"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
          </button>
        </div>
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
          onClick={() => { setTestDowngradeReason('canceled'); setShowTestDowngrade(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 rounded-xl text-sm text-orange-400 hover:text-orange-300 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
          </svg>
          Test Downgrade
        </button>
        <button
          onClick={() => { setTestDowngradeReason('payment_failed'); setShowTestDowngrade(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-xl text-sm text-red-400 hover:text-red-300 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
          Test Payment Failed
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

      {/* Platform Stats (collapsed by default) */}
      <button
        onClick={() => setPlatformStatsOpen(!platformStatsOpen)}
        className="w-full flex items-center justify-between px-5 py-4 bg-lol-card border border-lol-border rounded-2xl hover:bg-lol-card-hover transition-colors group"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/10 flex items-center justify-center">
            <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 13h2v8H3zm6-4h2v12H9zm6-6h2v18h-2zm6 10h2v8h-2z" />
            </svg>
          </div>
          <div className="text-left">
            <h2 className="text-sm font-semibold text-white">Platform Stats</h2>
            <p className="text-xs text-gray-500">Users, drafts, games, and engagement metrics</p>
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-gray-500 group-hover:text-gray-300 transition-transform ${platformStatsOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {platformStatsOpen && <PlatformStats />}

      {/* Team Plan Demo (collapsed by default) */}
      <button
        onClick={() => setTeamPlanDemoOpen(!teamPlanDemoOpen)}
        className="w-full flex items-center justify-between px-5 py-4 bg-lol-card border border-lol-border rounded-2xl hover:bg-lol-card-hover transition-colors group"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div className="text-left">
            <h2 className="text-sm font-semibold text-white">Team Plan Demo</h2>
            <p className="text-xs text-gray-500">Toggle team plan status for testing</p>
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-gray-500 group-hover:text-gray-300 transition-transform ${teamPlanDemoOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {teamPlanDemoOpen && <TeamPlanDemo />}

      {/* Moderating */}
      <div>
        <h2 className="text-lg font-semibold text-white">Moderating</h2>
        <p className="text-sm text-gray-400 mt-0.5">Search and manage users, teams, tiers, and plans.</p>
      </div>
      <div className="relative">
        <Input
          placeholder="Search by name, user ID, or team ID..."
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
                    {(warningCounts[user.id] ?? 0) > 0 && (
                      <div>
                        <span className="text-gray-500">Warnings:</span>{' '}
                        <span className="text-amber-400 font-semibold">
                          {warningCounts[user.id]}
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
                      {!user.banned_at && user.tier !== 'developer' && (
                        <Button
                          size="sm"
                          onClick={() => setWarnTarget(user)}
                          className="!bg-amber-500 !text-black hover:!bg-amber-600 !border-amber-600"
                        >
                          Warn User
                        </Button>
                      )}
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
      {!searching && users.length === 0 && teams.length === 0 && query.trim() && !searchError && (
        <div className="text-center py-12 text-gray-500">
          No users or teams found. Try a different search term.
        </div>
      )}

      {/* Team results */}
      {teams.length > 0 && (
        <div className="border border-lol-border rounded-2xl overflow-hidden">
          <div className="grid grid-cols-[1fr_120px_100px_40px] gap-4 px-5 py-3 bg-lol-surface/50 border-b border-lol-border text-xs uppercase tracking-wider text-gray-500 font-medium">
            <span>Team</span>
            <span>Plan</span>
            <span>Created</span>
            <span />
          </div>

          {teams.map(team => (
            <div key={team.id}>
              <button
                onClick={() => selectTeam(team)}
                className={`w-full grid grid-cols-[1fr_120px_100px_40px] gap-4 px-5 py-3 text-left transition-colors hover:bg-lol-surface/30 ${
                  selectedTeam?.id === team.id
                    ? 'bg-lol-surface/50 border-l-2 border-l-lol-gold'
                    : 'border-l-2 border-l-transparent'
                }`}
              >
                {/* Team info with owner */}
                <div className="min-w-0">
                  <div className="text-sm font-medium text-white truncate">
                    {team.name}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {team.owner_avatar_url ? (
                      <img
                        src={team.owner_avatar_url}
                        alt={team.owner_display_name || 'Owner'}
                        className="w-4 h-4 rounded object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-4 h-4 rounded bg-gray-600 flex items-center justify-center text-white text-[8px] font-semibold shrink-0">
                        {(team.owner_display_name || '?').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="text-xs text-gray-500 truncate">
                      {team.owner_display_name || team.owner_id.slice(0, 8) + '...'}
                    </span>
                  </div>
                </div>

                {/* Plan badge + ban badge */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span
                    className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold ${
                      team.has_team_plan
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-gray-500/20 text-gray-400'
                    }`}
                  >
                    {team.has_team_plan ? (team.team_plan_status ?? 'active') : 'none'}
                  </span>
                  {team.banned_at && (
                    <span className="inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-500/20 text-red-400">
                      banned
                    </span>
                  )}
                </div>

                {/* Created */}
                <div className="flex items-center text-xs text-gray-400">
                  {formatDate(team.created_at)}
                </div>

                {/* Expand indicator */}
                <div className="flex items-center justify-end">
                  <svg
                    className={`w-4 h-4 text-gray-500 transition-transform ${
                      selectedTeam?.id === team.id ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {/* Expanded team detail */}
              {selectedTeam?.id === team.id && (
                <div className="px-5 py-4 bg-lol-dark/50 border-t border-lol-border space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Team ID:</span>{' '}
                      <span className="text-gray-300 font-mono text-xs">{team.id}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Owner:</span>{' '}
                      <span className="text-gray-300">{team.owner_display_name || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Members:</span>{' '}
                      <span className="text-gray-300">{team.member_count}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Enemy teams limit:</span>{' '}
                      <span className="text-gray-300">{team.team_max_enemy_teams}</span>
                    </div>
                    {team.banned_at && (
                      <>
                        <div>
                          <span className="text-gray-500">Banned:</span>{' '}
                          <span className="text-red-400">{formatDate(team.banned_at)}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Ban reason:</span>{' '}
                          <span className="text-red-400">{team.ban_reason || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Ban expires:</span>{' '}
                          <span className="text-yellow-400">
                            {team.ban_expires_at ? formatExpiry(team.ban_expires_at) : 'Permanent'}
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 flex-wrap">
                    {team.has_team_plan ? (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => setRevokeTarget(team)}
                      >
                        Revoke Team Plan
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleSetTeamPlan(team, true)}
                        disabled={teamPlanLoading}
                      >
                        {teamPlanLoading ? 'Granting...' : 'Grant Team Plan'}
                      </Button>
                    )}

                    <Button
                      size="sm"
                      onClick={() => {
                        setRenameTarget(team);
                        setNewTeamName(team.name);
                        setTeamMessage('');
                      }}
                    >
                      Rename
                    </Button>

                    <div className="ml-auto flex gap-2">
                      {team.banned_at ? (
                        <Button
                          size="sm"
                          onClick={() => handleUnbanTeam(team.id)}
                          disabled={unbanTeamLoading}
                        >
                          {unbanTeamLoading ? 'Unbanning...' : 'Unban Team'}
                        </Button>
                      ) : (
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => setBanTeamTarget(team)}
                        >
                          Ban Team
                        </Button>
                      )}
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => setDeleteTeamTarget(team)}
                      >
                        Delete Team
                      </Button>
                    </div>
                  </div>

                  {teamMessage && (
                    <div
                      className={`text-sm px-3 py-2 rounded-lg ${
                        teamMessage.includes('success')
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-red-500/10 text-red-400'
                      }`}
                    >
                      {teamMessage}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Revoke team plan confirmation modal */}
      <Modal
        isOpen={!!revokeTarget}
        onClose={() => setRevokeTarget(null)}
        title="Revoke Team Plan"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-300">
            Are you sure you want to revoke the team plan for{' '}
            <span className="font-semibold text-white">
              {revokeTarget?.name}
            </span>
            ? Team content will become archived and read-only.
          </p>
          <div className="flex gap-3 justify-end">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setRevokeTarget(null)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => revokeTarget && handleSetTeamPlan(revokeTarget, false)}
              disabled={teamPlanLoading}
            >
              {teamPlanLoading ? 'Revoking...' : 'Revoke Plan'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Rename team modal */}
      <Modal
        isOpen={!!renameTarget}
        onClose={() => setRenameTarget(null)}
        title="Rename Team"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400">Current name:</span>
            <span className="text-sm font-medium text-white">{renameTarget?.name}</span>
          </div>

          <Input
            label="New Name"
            value={newTeamName}
            onChange={e => setNewTeamName(e.target.value)}
            placeholder="Enter new team name..."
          />

          <div className="flex gap-3 justify-end">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setRenameTarget(null)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleRenameTeam}
              disabled={renameLoading || !newTeamName.trim() || newTeamName.trim() === renameTarget?.name}
            >
              {renameLoading ? 'Renaming...' : 'Rename'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete team confirmation modal */}
      <Modal
        isOpen={!!deleteTeamTarget}
        onClose={() => setDeleteTeamTarget(null)}
        title="Delete Team"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-300">
            Are you sure you want to permanently delete{' '}
            <span className="font-semibold text-white">
              {deleteTeamTarget?.name}
            </span>
            ? This will remove all team members, players, enemy teams, and associated data. This action cannot be undone.
          </p>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-gray-400">
              Message to team owner (sent as notification)
            </label>
            <textarea
              value={deleteTeamMessage}
              onChange={e => setDeleteTeamMessage(e.target.value)}
              rows={2}
              className="bg-lol-dark border border-lol-border rounded-xl px-3 py-2 text-sm text-white resize-none focus:border-lol-gold/50 focus:outline-none focus:ring-2 focus:ring-lol-gold/20"
              placeholder="Reason for deletion..."
            />
          </div>

          <div className="flex gap-3 justify-end">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setDeleteTeamTarget(null)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleDeleteTeam}
              disabled={deleteTeamLoading}
            >
              {deleteTeamLoading ? 'Deleting...' : 'Delete Permanently'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Ban team modal */}
      <Modal
        isOpen={!!banTeamTarget}
        onClose={() => setBanTeamTarget(null)}
        title="Ban Team"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-300">
            Ban{' '}
            <span className="font-semibold text-white">
              {banTeamTarget?.name}
            </span>
            ? The team will be flagged as banned.
          </p>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-gray-400">
              Reason
            </label>
            <textarea
              value={banTeamReason}
              onChange={e => setBanTeamReason(e.target.value)}
              rows={2}
              className="bg-lol-dark border border-lol-border rounded-xl px-3 py-2 text-sm text-white resize-none focus:border-lol-gold/50 focus:outline-none focus:ring-2 focus:ring-lol-gold/20"
              placeholder="Reason for ban..."
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-gray-400">
              Duration
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => { setBanTeamDuration('permanent'); setBanTeamExpiry(''); }}
                className={`flex flex-col items-center gap-1 px-3 py-3 rounded-xl border text-sm font-medium transition-all ${
                  banTeamDuration === 'permanent'
                    ? 'border-red-500 bg-red-500/10 text-red-400'
                    : 'border-lol-border bg-lol-dark text-gray-400 hover:border-gray-500'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18.178 8c5.096 0 5.096 8 0 8-5.095 0-7.133-8-12.739-8-4.585 0-4.585 8 0 8 5.606 0 7.644-8 12.739-8z"/></svg>
                Permanent
              </button>
              <button
                type="button"
                onClick={() => setBanTeamDuration('timed')}
                className={`flex flex-col items-center gap-1 px-3 py-3 rounded-xl border text-sm font-medium transition-all ${
                  banTeamDuration === 'timed'
                    ? 'border-red-500 bg-red-500/10 text-red-400'
                    : 'border-lol-border bg-lol-dark text-gray-400 hover:border-gray-500'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                Timed
              </button>
            </div>
            {banTeamDuration === 'timed' && (
              <input
                type="datetime-local"
                value={banTeamExpiry}
                onChange={e => setBanTeamExpiry(e.target.value)}
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

          {teamMessage && (
            <div
              className={`text-sm px-3 py-2 rounded-lg ${
                teamMessage.includes('success')
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-red-500/10 text-red-400'
              }`}
            >
              {teamMessage}
            </div>
          )}

          <div className="flex gap-3 justify-end">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setBanTeamTarget(null)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleBanTeam}
              disabled={banTeamLoading}
            >
              {banTeamLoading ? 'Banning...' : 'Confirm Ban'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete user confirmation modal */}
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

      {/* Warning modal */}
      <Modal
        isOpen={!!warnTarget}
        onClose={() => setWarnTarget(null)}
        title="Warn User"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-300">
            Send a warning to{' '}
            <span className="font-semibold text-white">
              {warnTarget?.display_name || warnTarget?.id}
            </span>
          </p>

          {warnTarget && (warningCounts[warnTarget.id] ?? 0) > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <svg className="w-4 h-4 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <span className="text-sm text-amber-400">
                This user has {warningCounts[warnTarget.id]} previous warning{warningCounts[warnTarget.id] !== 1 ? 's' : ''}
              </span>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-gray-400">
              Warning Message
            </label>
            <textarea
              value={warnMessage}
              onChange={e => setWarnMessage(e.target.value)}
              rows={3}
              className="bg-lol-dark border border-lol-border rounded-xl px-3 py-2 text-sm text-white resize-none focus:border-lol-gold/50 focus:outline-none focus:ring-2 focus:ring-lol-gold/20"
              placeholder="Describe what the user did wrong..."
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-gray-400">
              Category
            </label>
            <select
              value={warnCategory}
              onChange={e => setWarnCategory(e.target.value)}
              className="bg-lol-dark border border-lol-border rounded-xl px-3 py-2 text-sm text-white focus:border-lol-gold/50 focus:outline-none"
            >
              <option value="">Select category...</option>
              <option value="inappropriate_name">Inappropriate Name</option>
              <option value="inappropriate_avatar">Inappropriate Avatar</option>
              <option value="inappropriate_content">Inappropriate Content</option>
              <option value="spam">Spam</option>
              <option value="harassment">Harassment</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-gray-400">
              Next Consequence (if repeated)
            </label>
            <select
              value={warnNextConsequence}
              onChange={e => setWarnNextConsequence(e.target.value)}
              className="bg-lol-dark border border-lol-border rounded-xl px-3 py-2 text-sm text-white focus:border-lol-gold/50 focus:outline-none"
            >
              <option value="temporary_ban">Temporary Ban</option>
              <option value="permanent_ban">Permanent Ban</option>
              <option value="account_deletion">Account Deletion</option>
            </select>
          </div>

          <div className="flex gap-3 justify-end">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setWarnTarget(null)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleWarn}
              disabled={warnLoading || !warnMessage.trim()}
              className="!bg-amber-500 hover:!bg-amber-600 !text-black"
            >
              {warnLoading ? 'Sending...' : 'Send Warning'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Test downgrade modal (no-op handlers, mock data) */}
      <TierDowngradeModal
        testMode
        isOpen={showTestDowngrade}
        downgradeReason={testDowngradeReason}
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

      {/* Change PIN modal */}
      {showPinChange && (
        <Modal isOpen onClose={() => setShowPinChange(false)} title="Change Admin PIN">
          <AdminPinChange
            onComplete={() => setShowPinChange(false)}
            onCancel={() => setShowPinChange(false)}
          />
        </Modal>
      )}
    </div>
    </AdminPinGate>
  );
}

// Inline session timer component
function AdminSessionTimer({ expiresAt }: { expiresAt: Date }) {
  const [remaining, setRemaining] = useState('');

  useEffect(() => {
    const update = () => {
      const diff = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
      const m = Math.floor(diff / 60);
      const s = diff % 60;
      setRemaining(`${m}:${String(s).padStart(2, '0')}`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-lol-surface/50 border border-lol-border text-xs text-gray-400">
      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
      {remaining}
    </div>
  );
}
