import { useDraggable } from '@dnd-kit/core';
import { useChampionData } from '../../hooks/useChampionData';

interface DraggableChampionProps {
  championId: string;
  disabled?: boolean;
}

export default function DraggableChampion({ championId, disabled }: DraggableChampionProps) {
  const { getIconUrl, getChampionById } = useChampionData();
  const champion = getChampionById(championId);
  const iconUrl = getIconUrl(championId);

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `pool:${championId}`,
    disabled,
  });

  if (!champion) return null;

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`
        flex flex-col items-center gap-0.5
        ${disabled ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'}
        ${isDragging ? 'opacity-50' : ''}
        ${disabled ? 'opacity-30 grayscale' : ''}
      `}
      title={champion.name}
    >
      <img
        src={iconUrl}
        alt={champion.name}
        className={`size-16 rounded border transition-all ${disabled ? 'border-gray-800' : 'border-gray-700 hover:border-lol-gold'}`}
        loading="lazy"
      />
      <span className="text-[10px] text-gray-400 text-center truncate max-w-12">
        {champion.name}
      </span>
    </div>
  );
}
