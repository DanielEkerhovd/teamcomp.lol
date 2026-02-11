import { useDroppable } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Player, Role, ROLES } from '../../types';
import PlayerCard from './PlayerCard';

interface RoleSlotProps {
  role: Role;
  player: Player | undefined;
  onPlayerChange: (playerId: string, updates: Partial<Omit<Player, 'id'>>) => void;
}

export default function RoleSlot({ role, player, onPlayerChange }: RoleSlotProps) {
  const roleLabel = ROLES.find((r) => r.value === role)?.label || role;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: player?.id || `empty-${role}`,
    data: { type: 'player', role, player },
    disabled: !player,
  });

  const { isOver, setNodeRef: setDropRef } = useDroppable({
    id: `role-${role}`,
    data: { type: 'role', role },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setDropRef}
      className={`flex-1 min-w-36 rounded-xl p-1.5 transition-all duration-200 ${
        isOver ? 'bg-lol-gold/15 ring-2 ring-lol-gold/50' : ''
      }`}
    >
      <div className="text-xs text-lol-gold text-center mb-2 font-semibold uppercase tracking-wider bg-lol-gold/10 rounded-md py-1 px-2 mx-auto w-fit">
        {roleLabel}
      </div>
      {player ? (
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
      ) : (
        <div className="bg-lol-card/50 rounded-xl px-4 py-6 text-center text-gray-600 text-sm border border-dashed border-lol-border/50 h-38 flex items-center justify-center">
          Empty
        </div>
      )}
    </div>
  );
}
