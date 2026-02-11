import { useChampionData } from '../../hooks/useChampionData';
import { Champion } from '../../types';

interface ChampionGridProps {
  championIds: string[];
  onRemove?: (championId: string) => void;
  onClick?: (champion: Champion) => void;
  emptyMessage?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function ChampionGrid({
  championIds,
  onRemove,
  onClick,
  emptyMessage = 'No champions added',
  size = 'md',
}: ChampionGridProps) {
  const { getIconUrl, getChampionById } = useChampionData();

  const sizes = {
    sm: 'w-10 h-10',
    md: 'w-14 h-14',
    lg: 'w-20 h-20',
  };

  if (championIds.length === 0) {
    return (
      <div className="text-gray-500 text-sm py-4 text-center">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {championIds.map((championId) => {
        const champion = getChampionById(championId);
        return (
          <div
            key={championId}
            className="relative group"
          >
            <div
              onClick={() => onClick && champion && onClick(champion)}
              className={`${onClick ? 'cursor-pointer' : ''}`}
            >
              <img
                src={getIconUrl(championId)}
                alt={champion?.name || championId}
                title={champion?.name}
                className={`${sizes[size]} rounded-lg border-2 border-gray-600 hover:border-lol-gold transition-colors`}
                loading="lazy"
              />
            </div>
            {onRemove && (
              <button
                type="button"
                onClick={() => onRemove(championId)}
                className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 rounded-full text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
              >
                ×
              </button>
            )}
            {champion && (
              <div className="text-xs text-gray-400 text-center mt-1 truncate max-w-14">
                {champion.name}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
