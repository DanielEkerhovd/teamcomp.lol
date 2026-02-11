import { Team, Player } from '../../types';
import PlayerCard from './PlayerCard';

interface TeamRosterProps {
  team: Team;
  onPlayerChange: (playerId: string, updates: Partial<Omit<Player, 'id'>>) => void;
  compact?: boolean;
}

export default function TeamRoster({
  team,
  onPlayerChange,
  compact = false,
}: TeamRosterProps) {
  return (
    <div className="flex gap-2 flex-wrap">
      {team.players.map((player) => (
        <PlayerCard
          key={player.id}
          player={player}
          onChange={(updates) => onPlayerChange(player.id, updates)}
          compact={compact}
        />
      ))}
    </div>
  );
}
