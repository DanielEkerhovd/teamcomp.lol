import { useState } from 'react';
import { Card, Button, Select, Modal } from '../ui';
import { ChampionSearch } from './index';
import ChampionIcon from './ChampionIcon';
import { Champion, TeamChampionPriority, Priority } from '../../types';
import { useChampionData } from '../../hooks/useChampionData';

interface TeamChampionPoolProps {
  champions: TeamChampionPriority[];
  onAdd: (championId: string, priority: Priority, notes?: string) => void;
  onRemove: (championId: string) => void;
  title?: string;
}

const PRIORITY_OPTIONS: { value: Priority; label: string; color: string }[] = [
  { value: 'high', label: 'High', color: 'text-red-400' },
  { value: 'medium', label: 'Medium', color: 'text-yellow-400' },
  { value: 'low', label: 'Low', color: 'text-blue-400' },
];

export default function TeamChampionPool({
  champions,
  onAdd,
  onRemove,
  title = 'Team Champion Pool',
}: TeamChampionPoolProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedChampion, setSelectedChampion] = useState<Champion | null>(null);
  const [selectedPriority, setSelectedPriority] = useState<Priority>('high');
  const { getChampionById } = useChampionData();

  const handleSelect = (champion: Champion) => {
    setSelectedChampion(champion);
    setIsModalOpen(true);
  };

  const handleAddChampion = () => {
    if (selectedChampion) {
      onAdd(selectedChampion.id, selectedPriority);
      setIsModalOpen(false);
      setSelectedChampion(null);
      setSelectedPriority('high');
    }
  };

  const groupedByPriority = {
    high: champions.filter((c) => c.priority === 'high'),
    medium: champions.filter((c) => c.priority === 'medium'),
    low: champions.filter((c) => c.priority === 'low'),
  };

  return (
    <>
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-gray-300">{title}</h3>

        <ChampionSearch
          onSelect={handleSelect}
          placeholder="Add champion..."
          excludeIds={champions.map((c) => c.championId)}
        />

        {champions.length === 0 ? (
          <div className="text-gray-500 text-sm py-4 text-center bg-lol-dark rounded-lg">
            No champions added
          </div>
        ) : (
          <div className="space-y-3">
            {PRIORITY_OPTIONS.map(({ value, label, color }) => {
              const items = groupedByPriority[value];
              if (items.length === 0) return null;
              return (
                <div key={value}>
                  <h4 className={`text-sm font-medium ${color} mb-2`}>{label} Priority</h4>
                  <div className="flex flex-wrap gap-2">
                    {items.map((item) => {
                      const champion = getChampionById(item.championId);
                      return (
                        <div
                          key={item.championId}
                          className="relative group"
                        >
                          <ChampionIcon
                            championId={item.championId}
                            size="md"
                            showName
                          />
                          <button
                            type="button"
                            onClick={() => onRemove(item.championId)}
                            className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add Team Champion"
      >
        {selectedChampion && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <ChampionIcon championId={selectedChampion.id} size="lg" />
              <div>
                <div className="text-white font-medium">{selectedChampion.name}</div>
              </div>
            </div>

            <Select
              label="Priority"
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value as Priority)}
              options={PRIORITY_OPTIONS.map((p) => ({ value: p.value, label: p.label }))}
            />

            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddChampion}>Add</Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
