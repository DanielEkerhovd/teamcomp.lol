import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend,
} from 'recharts';

interface AnalyticsData {
  views_today: number;
  views_week: number;
  views_month: number;
  unique_today: number;
  unique_week: number;
  unique_month: number;
  top_pages: { page_url: string; views: number; unique_visitors: number }[];
  daily_views: { day: string; views: number; unique_visitors: number }[];
  devices: { device: string; count: number }[];
}

type DateRange = '7d' | '14d' | '30d' | '90d';

const DEVICE_COLORS: Record<string, string> = {
  desktop: '#F0B232',
  mobile: '#0AC8B9',
  tablet: '#8B5CF6',
  unknown: '#6B7280',
};

const DATE_RANGE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: '7d', label: '7d' },
  { value: '14d', label: '14d' },
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
];

function formatDay(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function truncateUrl(url: string, max = 30): string {
  if (url.length <= max) return url;
  return url.slice(0, max - 3) + '...';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-lol-card border border-lol-border rounded-xl px-4 py-3 shadow-xl">
      <p className="text-gray-400 text-xs mb-1">{label}</p>
      {payload.map((entry: { name: string; value: number; color: string }, i: number) => (
        <p key={i} className="text-sm font-semibold" style={{ color: entry.color }}>
          {entry.name}: {entry.value.toLocaleString()}
        </p>
      ))}
    </div>
  );
}

export default function AnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dateRange, setDateRange] = useState<DateRange>('30d');

  const fetchAnalytics = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError('');

    const days = parseInt(dateRange);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data: result, error: rpcError } = await supabase.rpc(
      'get_analytics_summary',
      {
        p_start_date: startDate.toISOString(),
        p_end_date: new Date().toISOString(),
      }
    );

    if (rpcError) {
      setError(rpcError.message);
      setData(null);
    } else {
      setData(result as unknown as AnalyticsData);
    }
    setLoading(false);
  }, [dateRange]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

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

  const chartDailyViews = data.daily_views.map(d => ({
    ...d,
    day: formatDay(d.day),
  }));

  const chartTopPages = data.top_pages.map(p => ({
    ...p,
    label: truncateUrl(p.page_url),
  }));

  const chartDevices = data.devices.map(d => ({
    name: d.device.charAt(0).toUpperCase() + d.device.slice(1),
    value: d.count,
    color: DEVICE_COLORS[d.device] || DEVICE_COLORS.unknown,
  }));

  const stats = [
    { label: 'Views Today', value: data.views_today },
    { label: 'Views This Week', value: data.views_week },
    { label: 'Views This Month', value: data.views_month },
    { label: 'Unique Today', value: data.unique_today },
    { label: 'Unique This Week', value: data.unique_week },
    { label: 'Unique This Month', value: data.unique_month },
  ];

  return (
    <div className="space-y-5">
      {/* Date range selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 bg-lol-surface border border-lol-border rounded-xl p-1">
          {DATE_RANGE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setDateRange(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                dateRange === opt.value
                  ? 'bg-lol-gold/20 text-lol-gold'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <button
          onClick={fetchAnalytics}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3">
        {stats.map(stat => (
          <div
            key={stat.label}
            className="bg-lol-card border border-lol-border rounded-2xl p-4"
          >
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
              {stat.label}
            </div>
            <div className="text-2xl font-bold text-white">
              {stat.value.toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      {/* Visitors over time */}
      {chartDailyViews.length > 0 && (
        <div className="bg-lol-card border border-lol-border rounded-2xl p-5">
          <h3 className="text-sm font-medium text-gray-400 mb-4">Visitors Over Time</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartDailyViews}>
              <CartesianGrid stroke="#2D333D" strokeDasharray="3 3" />
              <XAxis
                dataKey="day"
                tick={{ fill: '#6B7280', fontSize: 11 }}
                axisLine={{ stroke: '#2D333D' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#6B7280', fontSize: 11 }}
                axisLine={{ stroke: '#2D333D' }}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="views"
                name="Page Views"
                stroke="#F0B232"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#F0B232' }}
              />
              <Line
                type="monotone"
                dataKey="unique_visitors"
                name="Unique Visitors"
                stroke="#0AC8B9"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#0AC8B9' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Bottom row: Top pages + Device breakdown */}
      <div className="grid grid-cols-[1fr_280px] gap-5">
        {/* Top pages */}
        {chartTopPages.length > 0 && (
          <div className="bg-lol-card border border-lol-border rounded-2xl p-5">
            <h3 className="text-sm font-medium text-gray-400 mb-4">Top Pages</h3>
            <ResponsiveContainer width="100%" height={Math.max(200, chartTopPages.length * 32)}>
              <BarChart data={chartTopPages} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid stroke="#2D333D" strokeDasharray="3 3" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fill: '#6B7280', fontSize: 11 }}
                  axisLine={{ stroke: '#2D333D' }}
                  tickLine={false}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  tick={{ fill: '#9CA3AF', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={140}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="views" name="Views" fill="#F0B232" radius={[0, 4, 4, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Device breakdown */}
        {chartDevices.length > 0 && (
          <div className="bg-lol-card border border-lol-border rounded-2xl p-5">
            <h3 className="text-sm font-medium text-gray-400 mb-4">Devices</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={chartDevices}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={75}
                  strokeWidth={0}
                >
                  {chartDevices.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Legend
                  formatter={(value: string) => (
                    <span className="text-xs text-gray-400">{value}</span>
                  )}
                />
                <Tooltip
                  content={<CustomTooltip />}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
