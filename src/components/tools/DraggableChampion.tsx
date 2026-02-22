import { useDraggable } from '@dnd-kit/core';
import { useChampionData } from '../../hooks/useChampionData';

interface DraggableChampionProps {
  championId: string;
}

export default function DraggableChampion({ championId }: DraggableChampionProps) {
  const { getIconUrl, getChampionById } = useChampionData();
  const champion = getChampionById(championId);
  const iconUrl = getIconUrl(championId);

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `pool:${championId}`,
  });

  if (!champion) return null;

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`
        flex flex-col items-center gap-0.5 cursor-grab active:cursor-grabbing
        ${isDragging ? 'opacity-50' : ''}
      `}
      title={champion.name}
    >
      <img
        src={iconUrl}
        alt={champion.name}
        className="size-16 rounded border border-gray-700 transition-all hover:border-lol-gold"
        loading="lazy"
      />
      <span className="text-[10px] text-gray-400 text-center truncate max-w-12">
        {champion.name}
      </span>
    </div>
  );
}
