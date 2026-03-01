import { useState, useRef, useEffect } from 'react';
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
  const [isRoleOpen, setIsRoleOpen] = useState(false);
  const roleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (roleRef.current && !roleRef.current.contains(e.target as Node)) {
        setIsRoleOpen(false);
      }
    };
    if (isRoleOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isRoleOpen]);

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

  const currentRole = SUB_ROLES.find((r) => r.value === player.role);

  return (
    <div className={`w-[calc((100%-3rem)/5)] min-w-36 rounded-xl p-1.5 transition-all duration-200 ${
      isOver ? 'bg-lol-gold/15 ring-2 ring-lol-gold/50' : ''
    }`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Sub</span>
          <div className="relative" ref={roleRef}>
            <button
              onClick={() => setIsRoleOpen(!isRoleOpen)}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-lol-dark border border-lol-border hover:border-gray-500 transition-colors cursor-pointer"
            >
              <RoleIcon role={player.role} size="xs" />
              <span className="text-xs text-gray-400">{currentRole?.label}</span>
              <svg className={`w-2.5 h-2.5 text-gray-500 transition-transform ${isRoleOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {isRoleOpen && (
              <div className="absolute top-full left-0 mt-1 bg-lol-card border border-lol-border rounded-lg shadow-xl z-50 py-1 min-w-24">
                {SUB_ROLES.map((r) => (
                  <button
                    key={r.value}
                    onClick={() => {
                      onPlayerChange(player.id, { role: r.value as Role });
                      setIsRoleOpen(false);
                    }}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-xs transition-colors ${
                      player.role === r.value
                        ? 'text-lol-gold bg-lol-gold/10'
                        : 'text-gray-400 hover:text-white hover:bg-lol-dark/80'
                    }`}
                  >
                    <RoleIcon role={r.value as Role} size="xs" />
                    <span>{r.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
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
