import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Player, Role, ROLES } from '../../types';
import PlayerCard from './PlayerCard';

interface SubSlotProps {
  player: Player;
  onPlayerChange: (playerId: string, updates: Partial<Omit<Player, 'id'>>) => void;
  onRemove: () => void;
}

export default function SubSlot({ player, onPlayerChange, onRemove }: SubSlotProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: player.id,
    data: { type: 'player', player },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div className="flex-1 min-w-32 max-w-48 rounded-lg p-1">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Sub</span>
          <select
            value={player.role}
            onChange={(e) => onPlayerChange(player.id, { role: e.target.value as Role })}
            className="text-xs bg-lol-dark text-lol-gold border border-lol-border rounded px-1.5 py-0.5 focus:outline-none focus:border-lol-gold cursor-pointer"
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={onRemove}
          className="text-xs text-gray-500 hover:text-red-400 transition-colors"
          title="Remove sub"
        >
          ×
        </button>
      </div>
      <div ref={setNodeRef} style={style}>
        <PlayerCard
          player={player}
          onChange={(updates) => onPlayerChange(player.id, updates)}
          isDragging={isDragging}
          showRole={false}
          dragHandleProps={{ ...attributes, ...listeners }}
          compact
        />
      </div>
    </div>
  );
}
