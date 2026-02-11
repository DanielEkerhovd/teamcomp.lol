import { useState } from 'react';
import { Card, Button, Select, Modal } from '../ui';
import { ChampionSearch, ChampionIcon } from '../champion';
import { Champion, ChampionPriority, Role, Priority, ROLES } from '../../types';
import { useChampionData } from '../../hooks/useChampionData';

interface PriorityListProps {
  priorities: ChampionPriority[];
  onAdd: (championId: string, role: Role, priority: Priority, notes?: string) => void;
  onRemove: (championId: string) => void;
  onUpdate?: (championId: string, updates: Partial<Omit<ChampionPriority, 'championId'>>) => void;
  title?: string;
}

const PRIORITY_OPTIONS: { value: Priority; label: string; color: string }[] = [
  { value: 'high', label: 'High', color: 'text-red-400' },
  { value: 'medium', label: 'Medium', color: 'text-yellow-400' },
  { value: 'low', label: 'Low', color: 'text-blue-400' },
];

export default function PriorityList({
  priorities,
  onAdd,
  onRemove,
  onUpdate,
  title = 'Our Priorities',
}: PriorityListProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedChampion, setSelectedChampion] = useState<Champion | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role>('mid');
  const [selectedPriority, setSelectedPriority] = useState<Priority>('high');
  const { getChampionById } = useChampionData();

  const handleSelect = (champion: Champion) => {
    setSelectedChampion(champion);
    setIsModalOpen(true);
  };

  const handleAddPriority = () => {
    if (selectedChampion) {
      onAdd(selectedChampion.id, selectedRole, selectedPriority);
      setIsModalOpen(false);
      setSelectedChampion(null);
    }
  };

  const sortedPriorities = [...priorities].sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  const groupedByPriority = {
    high: sortedPriorities.filter((p) => p.priority === 'high'),
    medium: sortedPriorities.filter((p) => p.priority === 'medium'),
    low: sortedPriorities.filter((p) => p.priority === 'low'),
  };

  return (
    <>
      <Card variant="bordered">
        <h3 className="text-lg font-semibold text-lol-gold mb-3">{title}</h3>
        <div className="space-y-3">
          <ChampionSearch
            onSelect={handleSelect}
            placeholder="Add priority pick..."
            excludeIds={priorities.map((p) => p.championId)}
          />

          {priorities.length === 0 ? (
            <div className="text-gray-500 text-sm py-4 text-center">
              No priorities added
            </div>
          ) : (
            <div className="space-y-4">
              {PRIORITY_OPTIONS.map(({ value, label, color }) => {
                const items = groupedByPriority[value];
                if (items.length === 0) return null;
                return (
                  <div key={value}>
                    <h4 className={`text-sm font-medium ${color} mb-2`}>{label} Priority</h4>
                    <div className="space-y-2">
                      {items.map((item) => {
                        const champion = getChampionById(item.championId);
                        const roleLabel = ROLES.find((r) => r.value === item.role)?.label;
                        return (
                          <div
                            key={item.championId}
                            className="flex items-center gap-3 p-2 bg-lol-dark rounded-lg group"
                          >
                            <ChampionIcon championId={item.championId} size="sm" />
                            <div className="flex-1">
                              <div className="text-white text-sm">
                                {champion?.name}
                              </div>
                              <div className="text-gray-500 text-xs">{roleLabel}</div>
                            </div>
                            <button
                              type="button"
                              onClick={() => onRemove(item.championId)}
                              className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
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
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add Priority Pick"
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
              label="Role"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as Role)}
              options={ROLES}
            />

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
              <Button onClick={handleAddPriority}>Add</Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
