import { useState, useMemo } from 'react';
import { useChampionData } from '../../hooks/useChampionData';
import ChampionIcon from './ChampionIcon';

interface ChampionSelectorProps {
  selectedIds: string[];
  onToggle: (championId: string) => void;
  maxHeight?: string;
}

export default function ChampionSelector({
  selectedIds,
  onToggle,
  maxHeight = '300px',
}: ChampionSelectorProps) {
  const { champions, loading, searchChampions } = useChampionData();
  const [search, setSearch] = useState('');

  const filteredChampions = useMemo(() => {
    return searchChampions(search);
  }, [search, searchChampions]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-gray-500">
        Loading champions...
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search champions..."
          className="w-full px-3 py-2 bg-lol-dark rounded text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-lol-gold/50"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
          >
            ×
          </button>
        )}
      </div>

      <div
        className="overflow-y-auto"
        style={{ maxHeight }}
      >
        {filteredChampions.length === 0 ? (
          <div className="text-center py-4 text-gray-500 text-sm">
            No champions found
          </div>
        ) : (
          <div className="grid grid-cols-8 gap-1">
            {filteredChampions.map((champion) => (
              <ChampionIcon
                key={champion.id}
                championId={champion.id}
                size="sm"
                selected={selectedIds.includes(champion.id)}
                onClick={() => onToggle(champion.id)}
              />
            ))}
          </div>
        )}
      </div>

      {selectedIds.length > 0 && (
        <div className="text-xs text-gray-500 pt-1">
          {selectedIds.length} selected
        </div>
      )}
    </div>
  );
}
