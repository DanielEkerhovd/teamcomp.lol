import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/useAuthStore';
import Button from '../ui/Button';

type PermLevel = 'admins' | 'players' | 'all';

interface DemoTeam {
  id: string;
  name: string;
  user_id: string;
  has_team_plan: boolean;
  team_plan_status: string | null;
  team_max_enemy_teams: number;
  perm_drafts: PermLevel;
  perm_enemy_teams: PermLevel;
  perm_players: PermLevel;
}

export default function TeamPlanDemo() {
  const { user } = useAuthStore();
  const [teams, setTeams] = useState<DemoTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  // Load all teams owned by the current user
  const loadTeams = async () => {
    if (!user) return;
    setLoading(true);
    setError('');

    const { data, error: err } = await supabase
      .from('my_teams')
      .select('id, name, user_id, has_team_plan, team_plan_status, team_max_enemy_teams, perm_drafts, perm_enemy_teams, perm_players')
      .eq('user_id', user.id)
      .order('name');

    if (err) {
      setError(err.message);
    } else {
      setTeams((data as DemoTeam[]) ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadTeams();
  }, [user]);

  const handleTogglePlan = async (team: DemoTeam) => {
    setSavingId(team.id);
    setMessage('');

    const newHasPlan = !team.has_team_plan;
    const updates = {
      has_team_plan: newHasPlan,
      team_plan_status: newHasPlan ? 'active' : null,
      team_max_enemy_teams: newHasPlan ? 300 : 0,
    };

    const { error: err } = await supabase
      .from('my_teams')
      .update(updates as never)
      .eq('id', team.id);

    if (err) {
      setMessage(`Error: ${err.message}`);
    } else {
      setTeams(prev => prev.map(t =>
        t.id === team.id ? { ...t, ...updates } : t
      ));
      setMessage(`${team.name}: Plan ${newHasPlan ? 'activated' : 'deactivated'}`);
    }
    setSavingId(null);
  };

  const handleSetStatus = async (team: DemoTeam, status: string | null) => {
    setSavingId(team.id);
    setMessage('');

    const hasPlan = status === 'active' || status === 'past_due' || status === 'canceling';
    const updates = {
      team_plan_status: status,
      has_team_plan: hasPlan,
      team_max_enemy_teams: hasPlan ? 300 : 0,
    };

    const { error: err } = await supabase
      .from('my_teams')
      .update(updates as never)
      .eq('id', team.id);

    if (err) {
      setMessage(`Error: ${err.message}`);
    } else {
      setTeams(prev => prev.map(t =>
        t.id === team.id ? { ...t, ...updates } : t
      ));
      setMessage(`${team.name}: Status → ${status || 'none'}`);
    }
    setSavingId(null);
  };

  const handleSetPermission = async (team: DemoTeam, field: 'perm_drafts' | 'perm_enemy_teams' | 'perm_players', perm: PermLevel) => {
    setSavingId(team.id);
    setMessage('');

    const { error: err } = await supabase
      .from('my_teams')
      .update({ [field]: perm } as never)
      .eq('id', team.id);

    if (err) {
      setMessage(`Error: ${err.message}`);
    } else {
      setTeams(prev => prev.map(t =>
        t.id === team.id ? { ...t, [field]: perm } : t
      ));
      setMessage(`${team.name}: ${field} → ${perm}`);
    }
    setSavingId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-5 h-5 border-2 border-lol-gold/30 border-t-lol-gold rounded-full animate-spin" />
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

  if (teams.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No teams found. Create a team first to test team plan features.
      </div>
    );
  }

  const STATUS_COLORS: Record<string, string> = {
    active: 'bg-emerald-500/20 text-emerald-400',
    past_due: 'bg-yellow-500/20 text-yellow-400',
    canceling: 'bg-orange-500/20 text-orange-400',
    canceled: 'bg-red-500/20 text-red-400',
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        Toggle team plan status to test badges, archive mode, content permissions, and limit changes.
        Changes are applied directly to the database. Reload My Team / Enemy Teams / Draft List pages to see effects.
      </p>

      {message && (
        <div className={`text-sm px-3 py-2 rounded-lg ${
          message.startsWith('Error') ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'
        }`}>
          {message}
        </div>
      )}

      <div className="space-y-3">
        {teams.map(team => (
          <div
            key={team.id}
            className="bg-lol-dark/50 border border-lol-border rounded-xl p-4 space-y-3"
          >
            {/* Team header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-white">{team.name}</span>
                {team.team_plan_status && (
                  <span className={`inline-flex px-2 py-0.5 rounded-lg text-xs font-semibold ${STATUS_COLORS[team.team_plan_status] || 'bg-gray-500/20 text-gray-400'}`}>
                    {team.team_plan_status}
                  </span>
                )}
                {team.has_team_plan && (
                  <span className="inline-flex px-2 py-0.5 rounded-lg text-xs font-semibold bg-lol-gold/20 text-lol-gold">
                    Team Plan
                  </span>
                )}
              </div>
              <Button
                size="sm"
                variant={team.has_team_plan ? 'danger' : 'primary'}
                onClick={() => handleTogglePlan(team)}
                disabled={savingId === team.id}
              >
                {savingId === team.id ? '...' : team.has_team_plan ? 'Deactivate Plan' : 'Activate Plan'}
              </Button>
            </div>

            {/* Controls */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {/* Plan Status */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500">Plan Status</label>
                <select
                  value={team.team_plan_status || 'none'}
                  onChange={e => handleSetStatus(team, e.target.value === 'none' ? null : e.target.value)}
                  disabled={savingId === team.id}
                  className="bg-lol-dark border border-lol-border rounded-lg px-2.5 py-1.5 text-sm text-white focus:border-lol-gold/50 focus:outline-none focus:ring-1 focus:ring-lol-gold/20"
                >
                  <option value="none">None</option>
                  <option value="active">Active</option>
                  <option value="past_due">Past Due</option>
                  <option value="canceling">Canceling</option>
                  <option value="canceled">Canceled</option>
                </select>
              </div>

              {/* Content Permissions */}
              {(['perm_drafts', 'perm_enemy_teams', 'perm_players'] as const).map(field => (
                <div key={field} className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-500">{field.replace('perm_', '').replace('_', ' ')}</label>
                  <select
                    value={team[field]}
                    onChange={e => handleSetPermission(team, field, e.target.value as PermLevel)}
                    disabled={savingId === team.id}
                    className="bg-lol-dark border border-lol-border rounded-lg px-2.5 py-1.5 text-sm text-white focus:border-lol-gold/50 focus:outline-none focus:ring-1 focus:ring-lol-gold/20"
                  >
                    <option value="admins">Admins Only</option>
                    <option value="players">Admins + Players</option>
                    <option value="all">All Members</option>
                  </select>
                </div>
              ))}
            </div>

            {/* Info row */}
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span>Enemy team limit: <span className="text-gray-300">{team.team_max_enemy_teams}</span></span>
              <span className="font-mono">{team.id.slice(0, 12)}...</span>
            </div>
          </div>
        ))}
      </div>

      <Button
        size="sm"
        variant="secondary"
        onClick={loadTeams}
      >
        Refresh Teams
      </Button>
    </div>
  );
}
