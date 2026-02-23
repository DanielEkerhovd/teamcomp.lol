import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState } from 'react';
import { Card } from '../ui';
import { ChampionSearch, ChampionIcon } from '../champion';
import { useChampionData } from '../../hooks/useChampionData';

interface SortableChampionTagProps {
  championId: string;
  onRemove: (championId: string) => void;
}

function SortableChampionTag({ championId, onRemove }: SortableChampionTagProps) {
  const { getChampionById } = useChampionData();
  const champion = getChampionById(championId);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: championId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 px-3 py-2 bg-lol-gold/10 border border-lol-gold/30 rounded-lg group cursor-grab active:cursor-grabbing"
      {...attributes}
      {...listeners}
    >
      <ChampionIcon championId={championId} size="md" />
      <span className="text-sm text-lol-gold">{champion?.name}</span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove(championId);
        }}
        className="opacity-0 group-hover:opacity-100 text-lol-gold hover:text-lol-gold-light transition-opacity"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

interface PriorityListProps {
  priorities: string[]; // simple array of champion IDs
  onAdd: (championId: string) => void;
  onRemove: (championId: string) => void;
  onReorder: (championIds: string[]) => void;
  title?: string;
}

export default function PriorityList({
  priorities,
  onAdd,
  onRemove,
  onReorder,
  title = 'Our Priorities',
}: PriorityListProps) {
  const { getChampionById, getIconUrl } = useChampionData();
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const handleSelect = (champion: { id: string }) => {
    onAdd(champion.id);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (over && active.id !== over.id) {
      const oldIndex = priorities.indexOf(active.id as string);
      const newIndex = priorities.indexOf(over.id as string);
      onReorder(arrayMove(priorities, oldIndex, newIndex));
    }
  };

  const activeChampion = activeId ? getChampionById(activeId) : null;

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
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={priorities} strategy={horizontalListSortingStrategy}>
            <div className="flex flex-wrap gap-2 mt-3">
              {priorities.map((championId) => (
                <SortableChampionTag
                  key={championId}
                  championId={championId}
                  onRemove={onRemove}
                />
              ))}
            </div>
          </SortableContext>
          <DragOverlay>
            {activeChampion && (
              <div className="flex items-center gap-2 px-3 py-2 bg-lol-gold/10 border border-lol-gold/30 rounded-lg shadow-lg">
                <ChampionIcon championId={activeId!} size="md" />
                <span className="text-sm text-lol-gold">{activeChampion.name}</span>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}
    </Card>
  );
}
