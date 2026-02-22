import { useSortable } from '@dnd-kit/sortable';
import { Player, Role, SUB_ROLES } from '../../types';
import PlayerCard from './PlayerCard';
import RoleIcon from './RoleIcon';

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
    isDragging,
    isOver,
  } = useSortable({
    id: player.id,
    data: { type: 'player', player },
  });

  return (
    <div className={`w-[calc((100%-3rem)/5)] min-w-36 rounded-xl p-1.5 transition-all duration-200 ${
      isOver ? 'bg-lol-gold/15 ring-2 ring-lol-gold/50' : ''
    }`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Sub</span>
          <RoleIcon role={player.role} size="xs" />
          <select
            value={player.role}
            onChange={(e) => onPlayerChange(player.id, { role: e.target.value as Role })}
            className="text-xs bg-lol-dark text-gray-400 border border-lol-border rounded px-1.5 py-0.5 focus:outline-none focus:border-gray-500 cursor-pointer"
          >
            {SUB_ROLES.map((r) => (
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
      <div
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing"
      >
        <PlayerCard
          player={player}
          onChange={(updates) => onPlayerChange(player.id, updates)}
          isDragging={isDragging}
          showRole={false}
          compact
        />
      </div>
    </div>
  );
}
