import { useState, useRef, useEffect } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChampionGroup } from '../../types';
import { ChampionIcon, ChampionSearch } from '../champion';
import { useChampionData } from '../../hooks/useChampionData';
import { Card } from '../ui';

interface SortableChampionProps {
  championId: string;
  groupId: string;
  onRemove: (groupId: string, championId: string) => void;
  colorClass: string;
  bgClass: string;
  borderClass: string;
}

// Inline add champion placeholder - appears as a dashed square at the end of the list
interface InlineAddChampionProps {
  groupId: string;
  onAdd: (groupId: string, championId: string) => void;
  excludeIds: string[];
  colorClass: string;
  borderClass: string;
}

function InlineAddChampion({ groupId, onAdd, excludeIds, colorClass, borderClass }: InlineAddChampionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { searchChampions, getIconUrl } = useChampionData();
  const wrapperRef = useRef<HTMLDivElement>(null);

  const results = searchChampions(query).filter((c) => !excludeIds.includes(c.id));

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (championId: string) => {
    onAdd(groupId, championId);
    setQuery('');
    setIsOpen(false);
  };

  return (
    <div ref={wrapperRef} className="relative">
      {isOpen ? (
        <div className="flex flex-col">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && results.length > 0) {
                handleSelect(results[0].id);
              }
              if (e.key === 'Escape') {
                setIsOpen(false);
                setQuery('');
              }
            }}
            placeholder="Search..."
            autoFocus
            className={`w-28 h-10 px-2 text-xs bg-lol-dark border ${borderClass} rounded-lg text-white placeholder-gray-500 focus:outline-none`}
          />
          {query && results.length > 0 && (
            <div className="absolute top-full left-0 z-9999 w-48 mt-1 bg-lol-card border border-lol-border rounded-lg shadow-xl max-h-48 overflow-y-auto">
              {results.slice(0, 8).map((champion) => (
                <button
                  key={champion.id}
                  type="button"
                  onClick={() => handleSelect(champion.id)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-lol-surface text-left"
                >
                  <img
                    src={getIconUrl(champion.id)}
                    alt={champion.name}
                    className="w-6 h-6 rounded"
                    loading="lazy"
                  />
                  <span className="text-white text-sm">{champion.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className={`w-10 h-10 flex items-center justify-center border-2 border-dashed ${borderClass} rounded-lg ${colorClass} opacity-50 hover:opacity-100 transition-opacity`}
          title="Add champion"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      )}
    </div>
  );
}

// Sortable group wrapper for drag-and-drop reordering
interface SortableGroupProps {
  group: ChampionGroup;
  children: React.ReactNode;
  colors: { text: string; bg: string; border: string; headerBg: string };
}

function SortableGroup({ group, children, colors }: SortableGroupProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `group:${group.id}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border ${colors.border} ${colors.headerBg}`}
    >
      {/* Drag handle in the group header */}
      <div className="flex items-center gap-2">
        <button
          {...attributes}
          {...listeners}
          className="p-2 text-gray-500 hover:text-gray-300 cursor-grab active:cursor-grabbing"
          title="Drag to reorder"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
          </svg>
        </button>
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}

function SortableChampion({
  championId,
  groupId,
  onRemove,
  colorClass,
  bgClass,
  borderClass,
}: SortableChampionProps) {
  const { getChampionById } = useChampionData();
  const champion = getChampionById(championId);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `${groupId}:${championId}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 px-3 py-2 ${bgClass} border ${borderClass} rounded-lg group cursor-grab active:cursor-grabbing`}
      {...attributes}
      {...listeners}
    >
      <ChampionIcon championId={championId} size="md" />
      <span className={`text-sm ${colorClass}`}>{champion?.name}</span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove(groupId, championId);
        }}
        className={`opacity-0 group-hover:opacity-100 ${colorClass} hover:brightness-125 transition-opacity`}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

interface GroupedChampionListProps {
  title: string;
  groups: ChampionGroup[];
  variant: 'ban' | 'priority';
  onAddGroup: (name: string) => void;
  onRenameGroup: (groupId: string, name: string) => void;
  onDeleteGroup: (groupId: string) => void;
  onReorderGroups: (groupIds: string[]) => void;
  onAddChampion: (groupId: string, championId: string) => void;
  onRemoveChampion: (groupId: string, championId: string) => void;
  onReorderChampions: (groupId: string, championIds: string[]) => void;
  onMoveChampion: (fromGroupId: string, toGroupId: string, championId: string, toIndex?: number) => void;
  // For legacy add (when using the main search)
  onAddToFirstGroup?: (championId: string) => void;
}

export default function GroupedChampionList({
  title,
  groups,
  variant,
  onAddGroup,
  onRenameGroup,
  onDeleteGroup,
  onReorderGroups,
  onAddChampion,
  onRemoveChampion,
  onReorderChampions,
  onMoveChampion,
  onAddToFirstGroup,
}: GroupedChampionListProps) {
  const { getChampionById } = useChampionData();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState('');

  const colors = variant === 'ban'
    ? { text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', headerBg: 'bg-red-500/5' }
    : { text: 'text-lol-gold', bg: 'bg-lol-gold/10', border: 'border-lol-gold/30', headerBg: 'bg-lol-gold/5' };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  // Parse the drag ID format: "type:groupId:championId" or "group:groupId"
  const parseId = (id: string) => {
    const parts = id.split(':');
    if (parts[0] === 'group') {
      return { type: 'group' as const, groupId: parts[1], championId: undefined };
    }
    // Champion format: "groupId:championId" (legacy) or with type prefix
    const groupId = parts.length === 3 ? parts[1] : parts[0];
    const championId = parts.length === 3 ? parts[2] : parts[1];
    return { type: 'champion' as const, groupId, championId };
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeIdStr = active.id as string;
    const overIdStr = over.id as string;

    // Check if dragging a group
    if (activeIdStr.startsWith('group:')) {
      const activeGroupId = activeIdStr.replace('group:', '');
      const overGroupId = overIdStr.replace('group:', '');

      if (activeGroupId !== overGroupId) {
        const oldIndex = groups.findIndex(g => g.id === activeGroupId);
        const newIndex = groups.findIndex(g => g.id === overGroupId);
        if (oldIndex !== -1 && newIndex !== -1) {
          onReorderGroups(arrayMove(groups.map(g => g.id), oldIndex, newIndex));
        }
      }
      return;
    }

    // Champion drag
    const activeData = parseId(activeIdStr);
    const overData = parseId(overIdStr);

    if (activeData.type !== 'champion' || !activeData.championId) return;

    if (activeData.groupId === overData.groupId && overData.championId) {
      // Reorder within same group
      const group = groups.find(g => g.id === activeData.groupId);
      if (group && activeData.championId !== overData.championId) {
        const oldIndex = group.championIds.indexOf(activeData.championId);
        const newIndex = group.championIds.indexOf(overData.championId);
        onReorderChampions(activeData.groupId, arrayMove(group.championIds, oldIndex, newIndex));
      }
    } else if (overData.groupId && overData.championId) {
      // Move between groups
      const overGroup = groups.find(g => g.id === overData.groupId);
      if (overGroup) {
        const toIndex = overGroup.championIds.indexOf(overData.championId);
        onMoveChampion(activeData.groupId, overData.groupId, activeData.championId, toIndex >= 0 ? toIndex : undefined);
      }
    }
  };

  const handleAddGroup = () => {
    if (newGroupName.trim()) {
      onAddGroup(newGroupName.trim());
      setNewGroupName('');
      setIsAddingGroup(false);
    }
  };

  const handleStartRename = (group: ChampionGroup) => {
    setEditingGroupId(group.id);
    setEditingGroupName(group.name);
  };

  const handleFinishRename = () => {
    if (editingGroupId && editingGroupName.trim()) {
      onRenameGroup(editingGroupId, editingGroupName.trim());
    }
    setEditingGroupId(null);
    setEditingGroupName('');
  };

  // Get all champion IDs across all groups for exclusion
  const allChampionIds = groups.flatMap(g => g.championIds);

  const activeChampionId = activeId ? parseId(activeId).championId : null;
  const activeChampion = activeChampionId ? getChampionById(activeChampionId) : null;

  // Build flat list of all draggable IDs for SortableContext
  const allDraggableIds = groups.flatMap(g => g.championIds.map(c => `${g.id}:${c}`));

  return (
    <Card variant="bordered" padding="md" className="h-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className={`text-lg font-semibold ${colors.text}`}>{title}</h3>
        <button
          onClick={() => setIsAddingGroup(true)}
          className={`text-xs px-2 py-1 rounded ${colors.bg} ${colors.text} hover:brightness-125 transition-all`}
        >
          + Add Group
        </button>
      </div>

      {/* Main search - adds to first group */}
      {onAddToFirstGroup && (
        <ChampionSearch
          onSelect={(champion) => onAddToFirstGroup(champion.id)}
          placeholder={variant === 'ban' ? 'Add ban...' : 'Add priority...'}
          excludeIds={allChampionIds}
          variant="minimal"
        />
      )}

      {/* Add group input */}
      {isAddingGroup && (
        <div className="flex gap-2 mt-3">
          <input
            type="text"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddGroup();
              if (e.key === 'Escape') setIsAddingGroup(false);
            }}
            placeholder="Group name..."
            autoFocus
            className="flex-1 px-3 py-1.5 text-sm bg-lol-dark border border-lol-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-lol-border-light"
          />
          <button
            onClick={handleAddGroup}
            className={`px-3 py-1.5 text-sm rounded-lg ${colors.bg} ${colors.text} hover:brightness-125`}
          >
            Add
          </button>
          <button
            onClick={() => setIsAddingGroup(false)}
            className="px-3 py-1.5 text-sm rounded-lg bg-lol-dark text-gray-400 hover:text-white"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Groups */}
      {groups.length === 0 ? (
        <p className="text-gray-500 text-sm py-4 text-center mt-3">
          No groups yet. Add a group to get started.
        </p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {/* Outer sortable context for groups */}
          <SortableContext items={groups.map(g => `group:${g.id}`)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3 mt-3">
              {groups.map((group) => (
                <SortableGroup key={group.id} group={group} colors={colors}>
                  {/* Group header */}
                  <div className="flex items-center justify-between px-3 py-2 border-b border-lol-border/30">
                    {editingGroupId === group.id ? (
                      <input
                        type="text"
                        value={editingGroupName}
                        onChange={(e) => setEditingGroupName(e.target.value)}
                        onBlur={handleFinishRename}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleFinishRename();
                          if (e.key === 'Escape') {
                            setEditingGroupId(null);
                            setEditingGroupName('');
                          }
                        }}
                        autoFocus
                        className="flex-1 px-2 py-0.5 text-sm bg-lol-dark border border-lol-border rounded text-white focus:outline-none"
                      />
                    ) : (
                      <span
                        className={`text-sm font-medium ${colors.text} cursor-pointer hover:brightness-125`}
                        onClick={() => handleStartRename(group)}
                        title="Click to rename"
                      >
                        {group.name}
                        <span className="text-gray-500 ml-2">({group.championIds.length})</span>
                      </span>
                    )}
                    <button
                      onClick={() => onDeleteGroup(group.id)}
                      className="text-gray-500 hover:text-red-400 transition-colors"
                      title="Delete group"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>

                  {/* Group champions */}
                  <SortableContext items={group.championIds.map(c => `${group.id}:${c}`)} strategy={horizontalListSortingStrategy}>
                    <div className="p-2 min-h-[48px]">
                      <div className="flex flex-wrap gap-2 items-center">
                        {group.championIds.map((championId) => (
                          <SortableChampion
                            key={`${group.id}:${championId}`}
                            championId={championId}
                            groupId={group.id}
                            onRemove={onRemoveChampion}
                            colorClass={colors.text}
                            bgClass={colors.bg}
                            borderClass={colors.border}
                          />
                        ))}
                        {/* Inline add champion placeholder */}
                        <InlineAddChampion
                          groupId={group.id}
                          onAdd={onAddChampion}
                          excludeIds={allChampionIds}
                          colorClass={colors.text}
                          borderClass={colors.border}
                        />
                      </div>
                    </div>
                  </SortableContext>
                </SortableGroup>
              ))}
            </div>
          </SortableContext>

          <DragOverlay>
            {activeChampion && (
              <div className={`flex items-center gap-2 px-3 py-2 ${colors.bg} border ${colors.border} rounded-lg shadow-lg`}>
                <ChampionIcon championId={activeChampionId!} size="md" />
                <span className={`text-sm ${colors.text}`}>{activeChampion.name}</span>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}
    </Card>
  );
}
