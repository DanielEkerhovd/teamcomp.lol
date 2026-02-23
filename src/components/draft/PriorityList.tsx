import { Card } from '../ui';
import { ChampionSearch, ChampionIcon } from '../champion';
import { useChampionData } from '../../hooks/useChampionData';

interface PriorityListProps {
  priorities: string[]; // simple array of champion IDs
  onAdd: (championId: string) => void;
  onRemove: (championId: string) => void;
  title?: string;
}

export default function PriorityList({
  priorities,
  onAdd,
  onRemove,
  title = 'Our Priorities',
}: PriorityListProps) {
  const { getChampionById } = useChampionData();

  const handleSelect = (champion: { id: string }) => {
    onAdd(champion.id);
  };

  return (
    <Card variant="bordered" padding="md">
      <h3 className="text-lg font-semibold text-lol-gold mb-3">{title}</h3>
      <ChampionSearch
        onSelect={handleSelect}
        placeholder="Add priority pick..."
        excludeIds={priorities}
        variant="minimal"
      />

      {priorities.length === 0 ? (
          <p className="text-gray-500 text-sm py-4 text-center mt-3">
            No priorities added yet
          </p>
        ) : (
          <div className="flex flex-wrap gap-2 mt-3">
            {priorities.map((championId) => {
              const champion = getChampionById(championId);
              return (
                <div
                  key={championId}
                  className="flex items-center gap-2 px-3 py-2 bg-lol-gold/10 border border-lol-gold/30 rounded-lg group"
                >
                  <ChampionIcon championId={championId} size="md" />
                  <span className="text-sm text-lol-gold">{champion?.name}</span>
                  <button
                    type="button"
                    onClick={() => onRemove(championId)}
                    className="opacity-0 group-hover:opacity-100 text-lol-gold hover:text-lol-gold-light transition-opacity"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}
    </Card>
  );
}
