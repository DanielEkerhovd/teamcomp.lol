import { Link } from 'react-router-dom';
import { useMyTeamStore } from '../stores/useMyTeamStore';
import { useDraftStore } from '../stores/useDraftStore';
import { Card, Button } from '../components/ui';
import { ROLES } from '../types';

export default function HomePage() {
  const { teams, selectedTeamId } = useMyTeamStore();
  const myTeam = teams.find((t) => t.id === selectedTeamId) || teams[0];
  const { sessions } = useDraftStore();
  const mainPlayers = (myTeam?.players || [])
    .filter((p) => !p.isSub)
    .sort((a, b) => {
      const roleOrder = ROLES.map((r) => r.value);
      return roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role);
    });
  const recentSessions = sessions
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 3);

  return (
    <div className="space-y-10 py-4">
      {/* Hero Section */}
      <div className="text-center py-8">
        <h1 className="text-5xl font-bold text-white mb-4">
          Team<span className="text-lol-gold">Comp.lol</span>
        </h1>
        <p className="text-xl text-gray-400 max-w-2xl mx-auto">
          Team-based draft planning for League of Legends
        </p>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card variant="elevated" padding="lg">
          <h2 className="text-xl font-semibold text-white mb-6">Quick Actions</h2>
          <div className="space-y-4">
            <Link to="/draft" className="block">
              <Button variant="primary" size="lg" className="w-full">
                Start New Draft
              </Button>
            </Link>
            <Link to="/enemy-teams" className="block">
              <Button variant="secondary" size="lg" className="w-full">
                Manage Enemy Teams
              </Button>
            </Link>
            <Link to="/champion-pool" className="block">
              <Button variant="secondary" size="lg" className="w-full">
                Edit Champion Pool
              </Button>
            </Link>
          </div>
        </Card>

        <Card variant="elevated" padding="lg">
          <h2 className="text-xl font-semibold text-white mb-6">Recent Drafts</h2>
          {recentSessions.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-500 mb-3">
                <svg className="w-10 h-10 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-gray-500">No draft sessions yet</p>
              <Link to="/draft" className="inline-block mt-4">
                <Button variant="outline" size="sm">Create your first draft</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recentSessions.map((session) => (
                <Link
                  key={session.id}
                  to="/draft"
                  className="block p-4 bg-lol-dark rounded-xl border border-lol-border hover:bg-lol-card-hover hover:border-lol-border-light transition-all duration-200"
                >
                  <div className="text-white font-semibold">{session.name}</div>
                  <div className="text-sm text-gray-500 mt-1.5 flex items-center gap-2">
                    <span>{new Date(session.updatedAt).toLocaleDateString('en-GB')}</span>
                    <span className="text-gray-600">·</span>
                    <span className="text-yellow-500">{session.contestedPicks.length} contested</span>
                    <span className="text-gray-600">·</span>
                    <span className="text-red-400">{session.potentialBans.length} bans</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* My team preview */}
      <Card variant="elevated" padding="lg">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-white">{myTeam.name || 'My Team'}</h2>
            <p className="text-sm text-gray-400 mt-1">Your roster overview</p>
          </div>
          <Link to="/my-team">
            <Button variant="outline" size="sm">
              Edit Team
            </Button>
          </Link>
        </div>
        <div className="grid grid-cols-5 gap-4">
          {mainPlayers.map((player) => (
            <div
              key={player.id}
              className="text-center p-5 bg-lol-dark rounded-xl border border-lol-border hover:border-lol-border-light transition-colors"
            >
              <div className="text-xs font-semibold text-lol-gold uppercase tracking-wider mb-3">
                {player.role}
              </div>
              <div className="text-base text-white font-medium truncate">
                {player.summonerName
                  ? player.summonerName.charAt(0).toUpperCase() + player.summonerName.slice(1)
                  : '—'}
              </div>
              {player.tagLine && (
                <div className="text-xs text-gray-500 mt-1">#{player.tagLine}</div>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
