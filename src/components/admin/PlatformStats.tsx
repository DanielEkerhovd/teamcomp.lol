import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import {
  PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer,
} from 'recharts';

interface PlatformStatsData {
  // Users
  total_users: number;
  users_by_tier: Record<string, number>;
  new_users_week: number;
  new_users_month: number;
  banned_users: number;
  // Teams
  total_teams: number;
  teams_with_plan: number;
  total_team_members: number;
  banned_teams: number;
  // Draft Sessions
  total_drafts: number;
  active_drafts: number;
  archived_drafts: number;
  favorite_drafts: number;
  // Live Drafts
  total_live_drafts: number;
  live_drafts_by_status: Record<string, number>;
  live_draft_modes: Record<string, number>;
  // Live Draft Games
  total_games: number;
  completed_games: number;
  // Draft creators
  drafts_by_users: number;
  drafts_by_anon: number;
  // Game formats
  game_formats: Record<string, number>;
  // Social
  total_friendships: number;
  total_shares: number;
  total_share_views: number;
  // Subscriptions
  active_subscriptions: number;
  subscriptions_by_tier: Record<string, number>;
}

const TIER_COLORS: Record<string, string> = {
  free: '#6B7280',
  beta: '#3B82F6',
  paid: '#F0B232',
  supporter: '#EC4899',
  admin: '#8B5CF6',
  developer: '#10B981',
};

const MODE_COLORS: Record<string, string> = {
  normal: '#F0B232',
  fearless: '#0AC8B9',
  ironman: '#EF4444',
};

const STATUS_COLORS: Record<string, string> = {
  completed: '#10B981',
  in_progress: '#F0B232',
  lobby: '#3B82F6',
  paused: '#8B5CF6',
  cancelled: '#EF4444',
};

const FORMAT_COLORS: Record<string, string> = {
  Bo1: '#F0B232',
  Bo2: '#0AC8B9',
  Bo3: '#3B82F6',
  Bo5: '#8B5CF6',
  Bo7: '#EC4899',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-lol-card border border-lol-border rounded-xl px-4 py-3 shadow-xl">
      {payload.map((entry: { name: string; value: number; payload: { color: string } }, i: number) => (
        <p key={i} className="text-sm font-semibold" style={{ color: entry.payload.color }}>
          {entry.name}: {entry.value.toLocaleString()}
        </p>
      ))}
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="bg-lol-card border border-lol-border rounded-2xl p-4">
      <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</div>
      <div className="text-2xl font-bold text-white">{typeof value === 'number' ? value.toLocaleString() : value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">{children}</h3>
  );
}

function toChartData(record: Record<string, number> | null | undefined, colors: Record<string, string>) {
  if (!record) return [];
  return Object.entries(record).map(([key, value]) => ({
    name: key.charAt(0).toUpperCase() + key.slice(1).replace('_', ' '),
    value,
    color: colors[key] || '#6B7280',
  }));
}

export default function PlatformStats() {
  const [data, setData] = useState<PlatformStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchStats = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError('');

    try {
      const { data: result, error: rpcError } = await supabase.rpc('get_platform_stats');

      if (rpcError) {
        setError(rpcError.message);
        setData(null);
      } else if (!result || typeof result !== 'object') {
        setError('No data returned — has the migration been applied?');
        setData(null);
      } else {
        setData(result as unknown as PlatformStatsData);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch platform stats');
      setData(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-lol-gold/30 border-t-lol-gold rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
        {error}
      </div>
    );
  }

  if (!data) return null;

  const tierData = toChartData(data.users_by_tier, TIER_COLORS);
  const modeData = toChartData(data.live_draft_modes, MODE_COLORS);
  const statusData = toChartData(data.live_drafts_by_status, STATUS_COLORS);
  const formatData = toChartData(data.game_formats, FORMAT_COLORS);

  const creatorData = [
    { name: 'Logged-in', value: data.drafts_by_users, color: '#0AC8B9' },
    { name: 'Anonymous', value: data.drafts_by_anon, color: '#6B7280' },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-5">
      {/* Refresh */}
      <div className="flex justify-end">
        <button
          onClick={fetchStats}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Hero stats */}
      <SectionHeader>Overview</SectionHeader>
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Total Users" value={data.total_users} sub={`+${data.new_users_week} this week`} />
        <StatCard label="Total Teams" value={data.total_teams} sub={`${data.teams_with_plan} with plan`} />
        <StatCard label="Draft Sheets" value={data.total_drafts} sub={`${data.active_drafts} active`} />
        <StatCard label="Live Drafts" value={data.total_live_drafts} sub={`${data.live_drafts_by_status?.completed || 0} completed`} />
      </div>

      {/* Live Draft Details */}
      <SectionHeader>Live Draft Games</SectionHeader>
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Total Games" value={data.total_games} sub={`${data.completed_games} completed`} />
        <StatCard label="By Users" value={data.drafts_by_users} sub="Logged-in creators" />
        <StatCard label="By Anonymous" value={data.drafts_by_anon} sub="Non-logged-in creators" />
        <StatCard
          label="User Rate"
          value={
            data.drafts_by_users + data.drafts_by_anon > 0
              ? `${((data.drafts_by_users / (data.drafts_by_users + data.drafts_by_anon)) * 100).toFixed(1)}%`
              : 'N/A'
          }
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-3 gap-5">
        {/* User tier distribution */}
        {tierData.length > 0 && (
          <div className="bg-lol-card border border-lol-border rounded-2xl p-5">
            <h3 className="text-sm font-medium text-gray-400 mb-4">User Tiers</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={tierData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  strokeWidth={0}
                >
                  {tierData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Legend
                  formatter={(value: string) => (
                    <span className="text-xs text-gray-400">{value}</span>
                  )}
                />
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Draft mode distribution */}
        {modeData.length > 0 && (
          <div className="bg-lol-card border border-lol-border rounded-2xl p-5">
            <h3 className="text-sm font-medium text-gray-400 mb-4">Draft Modes</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={modeData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  strokeWidth={0}
                >
                  {modeData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Legend
                  formatter={(value: string) => (
                    <span className="text-xs text-gray-400">{value}</span>
                  )}
                />
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Live draft status distribution */}
        {statusData.length > 0 && (
          <div className="bg-lol-card border border-lol-border rounded-2xl p-5">
            <h3 className="text-sm font-medium text-gray-400 mb-4">Session Status</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={statusData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  strokeWidth={0}
                >
                  {statusData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Legend
                  formatter={(value: string) => (
                    <span className="text-xs text-gray-400">{value}</span>
                  )}
                />
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Creator + Game Format charts */}
      <div className="grid grid-cols-2 gap-5">
        {creatorData.length > 0 && (
          <div className="bg-lol-card border border-lol-border rounded-2xl p-5">
            <h3 className="text-sm font-medium text-gray-400 mb-4">Draft Creators</h3>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={creatorData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={65}
                  strokeWidth={0}
                >
                  {creatorData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Legend
                  formatter={(value: string) => (
                    <span className="text-xs text-gray-400">{value}</span>
                  )}
                />
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {formatData.length > 0 && (
          <div className="bg-lol-card border border-lol-border rounded-2xl p-5">
            <h3 className="text-sm font-medium text-gray-400 mb-4">Game Formats</h3>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={formatData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={65}
                  strokeWidth={0}
                >
                  {formatData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Legend
                  formatter={(value: string) => (
                    <span className="text-xs text-gray-400">{value}</span>
                  )}
                />
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* More stats */}
      <SectionHeader>Social &amp; Monetization</SectionHeader>
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Active Subs" value={data.active_subscriptions} sub={
          Object.entries(data.subscriptions_by_tier).map(([t, c]) => `${c} ${t}`).join(', ') || 'None'
        } />
        <StatCard label="Friendships" value={data.total_friendships} />
        <StatCard label="Draft Shares" value={data.total_shares} sub={`${data.total_share_views.toLocaleString()} views`} />
        <StatCard label="Team Members" value={data.total_team_members} />
      </div>

      {/* Moderation row */}
      <SectionHeader>Moderation</SectionHeader>
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Banned Users" value={data.banned_users} />
        <StatCard label="Banned Teams" value={data.banned_teams} />
        <StatCard label="New This Month" value={data.new_users_month} />
        <StatCard label="Favorite Drafts" value={data.favorite_drafts} />
      </div>
    </div>
  );
}
