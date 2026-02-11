import { useChampionData } from '../../hooks/useChampionData';

interface ChampionIconProps {
  championId: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  showName?: boolean;
  selected?: boolean;
  onClick?: () => void;
}

export default function ChampionIcon({
  championId,
  size = 'md',
  className = '',
  showName = false,
  selected = false,
  onClick,
}: ChampionIconProps) {
  const { getIconUrl, getChampionById } = useChampionData();
  const champion = getChampionById(championId);
  const iconUrl = getIconUrl(championId);

  const sizes = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  };

  if (!champion) {
    return (
      <div
        className={`${sizes[size]} rounded bg-lol-dark flex items-center justify-center text-gray-500 text-xs ${className}`}
        title="Unknown"
      >
        ?
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col items-center gap-0.5 ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
      title={champion.name}
    >
      <img
        src={iconUrl}
        alt={champion.name}
        className={`${sizes[size]} rounded transition-all ${
          selected
            ? 'ring-2 ring-lol-gold'
            : 'border border-gray-700 hover:border-gray-500'
        }`}
        loading="lazy"
      />
      {showName && (
        <span className="text-[10px] text-gray-400 text-center truncate max-w-12">
          {champion.name}
        </span>
      )}
    </div>
  );
}
