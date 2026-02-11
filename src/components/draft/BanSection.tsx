import { Card } from '../ui';
import { ChampionSearch, ChampionGrid } from '../champion';
import { Champion } from '../../types';

interface BanSectionProps {
  bans: string[];
  onAdd: (championId: string) => void;
  onRemove: (championId: string) => void;
  title?: string;
}

export default function BanSection({
  bans,
  onAdd,
  onRemove,
  title = 'Potential Bans',
}: BanSectionProps) {
  const handleSelect = (champion: Champion) => {
    onAdd(champion.id);
  };

  return (
    <Card variant="bordered">
      <h3 className="text-lg font-semibold text-red-400 mb-3">{title}</h3>
      <div className="space-y-3">
        <ChampionSearch
          onSelect={handleSelect}
          placeholder="Add ban..."
          excludeIds={bans}
        />
        <ChampionGrid
          championIds={bans}
          onRemove={onRemove}
          emptyMessage="No bans added"
          size="md"
        />
      </div>
    </Card>
  );
}
