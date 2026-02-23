import { Link } from 'react-router-dom';
import { useMyTeamStore, MAX_TEAMS } from '../stores/useMyTeamStore';
import { useDraftStore } from '../stores/useDraftStore';
import { Card, Button } from '../components/ui';
import { ROLES, Team } from '../types';

function TeamCard({ team, isSelected, onSelect }: { team: Team; isSelected: boolean; onSelect: () => void }) {
  const mainPlayers = (team.players || [])
    .filter((p) => !p.isSub)
    .sort((a, b) => {
      const roleOrder = ROLES.map((r) => r.value);
      return roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role);
    });

  return (
    <div
      onClick={onSelect}
      className={`cursor-pointer rounded-xl border-2 transition-all duration-200 ${
        isSelected
          ? 'border-lol-gold bg-lol-card'
          : 'border-lol-border bg-lol-dark hover:border-lol-border-light hover:bg-lol-card-hover'
      }`}
    >
      <div className="p-4 border-b border-lol-border">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">{team.name || 'Unnamed Team'}</h3>
          {isSelected && (
            <span className="text-xs font-semibold text-lol-gold bg-lol-gold/10 px-2 py-0.5 rounded">
              Active
            </span>
          )}
        </div>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-5 gap-2">
          {mainPlayers.map((player) => (
            <div key={player.id} className="text-center">
              <div className="text-[10px] font-semibold text-lol-gold uppercase tracking-wider mb-1">
                {player.role}
              </div>
              <div className="text-xs text-white font-medium truncate">
                {player.summonerName || '—'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const { teams, selectedTeamId, selectTeam, addTeam } = useMyTeamStore();
  const { sessions } = useDraftStore();
  const recentSessions = sessions
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 3);

  const handleAddTeam = () => {
    const teamNumber = teams.length + 1;
    addTeam(`Team ${teamNumber}`);
  };

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
                  to={`/draft/${session.id}`}
                  className="block p-4 bg-lol-dark rounded-xl border border-lol-border hover:bg-lol-card-hover hover:border-lol-border-light transition-all duration-200"
                >
                  <div className="text-white font-semibold">{session.name}</div>
                  <div className="text-sm text-gray-500 mt-1.5 flex items-center gap-2">
                    <span>{new Date(session.updatedAt).toLocaleDateString('en-GB')}</span>
                    <span className="text-gray-600">·</span>
                    <span className="text-yellow-500">{session.ourPriorities.length} priorities</span>
                    <span className="text-gray-600">·</span>
                    <span className="text-red-400">{session.potentialBans.length} bans</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* My Teams */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-white">My Teams</h2>
            <p className="text-sm text-gray-400 mt-1">Click a team to set it as active</p>
          </div>
          <Link to="/my-team">
            <Button variant="outline" size="sm">
              Manage Teams
            </Button>
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              isSelected={team.id === selectedTeamId}
              onSelect={() => selectTeam(team.id)}
            />
          ))}
          {teams.length < MAX_TEAMS && (
            <button
              onClick={handleAddTeam}
              className="flex items-center justify-center gap-2 p-8 rounded-xl border-2 border-dashed border-lol-border text-gray-500 hover:border-lol-gold hover:text-lol-gold transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="font-medium">Add Team</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
