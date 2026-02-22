import { useDroppable } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { Player, Role, ROLES } from '../../types';
import PlayerCard from './PlayerCard';
import RoleIcon from './RoleIcon';

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
    isDragging,
    isOver: isOverSortable,
  } = useSortable({
    id: player?.id || `empty-${role}`,
    data: { type: 'player', role, player },
    disabled: !player,
  });

  const { isOver: isOverDroppable, setNodeRef: setDropRef } = useDroppable({
    id: `role-${role}`,
    data: { type: 'role', role },
  });

  // Show highlight when dragging over either the role area or the player card
  const isOver = isOverDroppable || isOverSortable;

  return (
    <div
      ref={setDropRef}
      className={`flex-1 min-w-36 rounded-xl p-1.5 transition-all duration-200 ${
        isOver ? 'bg-lol-gold/15 ring-2 ring-lol-gold/50' : ''
      }`}
    >
      <div className="text-xs text-lol-gold text-center mb-2 font-semibold uppercase tracking-wider bg-lol-gold/10 rounded-md py-1 px-2 mx-auto w-fit flex items-center gap-1">
        <RoleIcon role={role} size="xs" />
        {roleLabel}
      </div>
      {player ? (
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
      ) : (
        <div className="bg-lol-card/50 rounded-xl px-4 py-6 text-center text-gray-600 text-sm border border-dashed border-lol-border/50 h-38 flex items-center justify-center">
          Empty
        </div>
      )}
    </div>
  );
}
