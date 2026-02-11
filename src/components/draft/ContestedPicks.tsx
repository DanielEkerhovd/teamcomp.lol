import { Card } from '../ui';
import { ChampionSearch, ChampionGrid } from '../champion';
import { Champion } from '../../types';

interface ContestedPicksProps {
  picks: string[];
  onAdd: (championId: string) => void;
  onRemove: (championId: string) => void;
  title?: string;
}

export default function ContestedPicks({
  picks,
  onAdd,
  onRemove,
  title = 'Contested Picks',
}: ContestedPicksProps) {
  const handleSelect = (champion: Champion) => {
    onAdd(champion.id);
  };

  return (
    <Card variant="bordered">
      <h3 className="text-lg font-semibold text-yellow-400 mb-3">{title}</h3>
      <div className="space-y-3">
        <ChampionSearch
          onSelect={handleSelect}
          placeholder="Add contested pick..."
          excludeIds={picks}
        />
        <ChampionGrid
          championIds={picks}
          onRemove={onRemove}
          emptyMessage="No contested picks added"
          size="md"
        />
      </div>
    </Card>
  );
}
