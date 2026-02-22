import { useDroppable, useDraggable } from '@dnd-kit/core';
import { useChampionData } from '../../hooks/useChampionData';

interface DraftSlotProps {
  id: string;
  championId: string | null;
  label?: string;
  side: 'blue' | 'red';
  size?: string;
  isOver?: boolean;
}

export default function DraftSlot({
  id,
  championId,
  label,
  side,
  size = 'size-22',
  isOver,
}: DraftSlotProps) {
  const { getIconUrl, getChampionById } = useChampionData();

  const { setNodeRef: setDroppableRef, isOver: isDroppableOver } = useDroppable({
    id,
  });

  const { attributes, listeners, setNodeRef: setDraggableRef, isDragging } = useDraggable({
    id,
    disabled: !championId,
  });

  const champion = championId ? getChampionById(championId) : null;
  const iconUrl = championId ? getIconUrl(championId) : null;
  const showIsOver = isOver || isDroppableOver;

  const sideColors = {
    blue: {
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/30',
      hoverBorder: 'hover:border-blue-500/50',
    },
    red: {
      bg: 'bg-red-500/10',
      border: 'border-red-500/30',
      hoverBorder: 'hover:border-red-500/50',
    },
  };

  const colors = sideColors[side];

  return (
    <div
      ref={setDroppableRef}
      className={`
        relative ${size} rounded-lg transition-all duration-200
        ${championId ? colors.bg : 'bg-lol-dark'}
        ${championId ? `border ${colors.border}` : 'border border-gray-700'}
        ${showIsOver ? 'border-lol-gold shadow-lg shadow-lol-gold/20' : ''}
        ${isDragging ? 'opacity-50' : ''}
        group
      `}
    >
      {/* Label */}
      {label && !championId && (
        <span className="absolute inset-0 flex items-center justify-center text-xs text-gray-500 font-medium">
          {label}
        </span>
      )}

      {/* Champion icon */}
      {champion && iconUrl && (
        <div
          ref={setDraggableRef}
          {...attributes}
          {...listeners}
          className="w-full h-full cursor-grab active:cursor-grabbing"
        >
          <img
            src={iconUrl}
            alt={champion.name}
            className="w-full h-full rounded-md object-cover"
            title={champion.name}
          />
        </div>
      )}

      {/* Drop indicator overlay */}
      {showIsOver && !championId && (
        <div className="absolute inset-0 rounded-lg bg-lol-gold/10" />
      )}
    </div>
  );
}
