import { useState, useRef, useEffect } from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  pointerWithin,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  useDroppable,
  useDraggable,
  CollisionDetection,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "../ui";
import ChampionIcon from "./ChampionIcon";
import { Champion, ChampionGroup, Role, ROLES } from "../../types";
import { useChampionData } from "../../hooks/useChampionData";
import { getChampionRoles } from "../../data/championRoles";
import { useCustomTemplatesStore } from "../../stores/useCustomTemplatesStore";

// Template definitions
interface GroupTemplate {
  id: string;
  name: string;
  description: string;
  groups: string[];
  roleSpecific?: boolean;
}

const PLAYSTYLE_BY_ROLE: Record<Role, string[]> = {
  top: ["Tank", "Bruiser", "Split Pusher", "Carry"],
  jungle: ["Tank", "Assassin", "Bruiser", "Utility"],
  mid: ["Assassin", "Mage", "Control Mage", "Roamer"],
  adc: ["Hypercarry", "Lane Bully", "Utility", "Safe", "Mage"],
  support: ["Engage", "Enchanter", "Mage", "Tank"],
};

const getTemplates = (role: Role): GroupTemplate[] => [
  {
    id: "tier-list",
    name: "Tier List",
    description: "Rank champions by strength",
    groups: ["S-Tier", "A-Tier", "B-Tier", "C-Tier"],
  },
  {
    id: "playstyle",
    name: "Playstyle",
    description: `Champion styles for ${role}`,
    groups: PLAYSTYLE_BY_ROLE[role] || ["Main", "Secondary", "Situational"],
    roleSpecific: true,
  },
  {
    id: "comfort-level",
    name: "Comfort Level",
    description: "By how confident you are",
    groups: ["Main", "Comfort Pick", "Learning", "Pocket Pick"],
  },
  {
    id: "draft-priority",
    name: "Draft Priority",
    description: "When to pick them in draft",
    groups: ["Blind Pickable", "Flex", "Counter Pick", "Banned Often"],
  },
];

export interface PlayerTierListData {
  championGroups?: ChampionGroup[];
  role?: Role; // Used for role-specific template generation
}

interface PlayerTierListProps {
  player: PlayerTierListData;
  onAddChampion: (groupId: string, championId: string) => void;
  onRemoveChampion: (groupId: string, championId: string) => void;
  onMoveChampion: (
    fromGroupId: string,
    toGroupId: string,
    championId: string,
    newIndex: number,
  ) => void;
  onReorderChampion: (
    groupId: string,
    championId: string,
    newIndex: number,
  ) => void;
  onAddGroup: (groupName: string) => void;
  onRemoveGroup: (groupId: string) => void;
  onRenameGroup: (groupId: string, newName: string) => void;
  onReorderGroups: (groupIds: string[]) => void;
}

interface SortableChampionProps {
  championId: string;
  groupId: string;
  onRemove: () => void;
}

function SortableChampion({
  championId,
  groupId,
  onRemove,
}: SortableChampionProps) {
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
    <div ref={setNodeRef} style={style} className="relative group">
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing"
      >
        <ChampionIcon championId={championId} size="lg" showName />
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
      >
        ×
      </button>
    </div>
  );
}

interface AddChampionButtonProps {
  onSelect: (champion: Champion) => void;
  excludeIds: string[];
}

function AddChampionButton({ onSelect, excludeIds }: AddChampionButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { searchChampions, getIconUrl } = useChampionData();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = searchChampions(query).filter(
    (c) => !excludeIds.includes(c.id),
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSelect = (champion: Champion) => {
    onSelect(champion);
    setQuery("");
    setIsOpen(false);
  };

  return (
    <div ref={wrapperRef} className="relative h-12 flex items-center">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="px-2 py-1 rounded border border-dashed border-gray-600/50 text-gray-500 hover:text-gray-300 hover:border-gray-500 text-xs transition-colors"
      >
        + add champ
      </button>
      {isOpen && (
        <div className="absolute z-50 top-full mt-1 left-0 w-64 bg-lol-gray border border-gray-600 rounded-lg shadow-lg">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && results.length > 0) {
                e.preventDefault();
                handleSelect(results[0]);
              }
              if (e.key === "Escape") {
                setIsOpen(false);
                setQuery("");
              }
            }}
            placeholder="Search champion..."
            className="w-full px-3 py-2 bg-transparent border-b border-gray-600 text-white placeholder-gray-500 text-sm focus:outline-none"
          />
          <div className="max-h-48 overflow-y-auto">
            {results.slice(0, 8).map((champion) => (
              <button
                key={champion.id}
                type="button"
                onClick={() => handleSelect(champion)}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-700 text-left"
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
            {query && results.length === 0 && (
              <div className="px-3 py-2 text-gray-400 text-sm">
                No champions found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface AddGroupButtonProps {
  onAddGroup: (name: string) => void;
  groupCount: number;
}

function AddGroupButton({ onAddGroup, groupCount }: AddGroupButtonProps) {
  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => onAddGroup(`Group ${groupCount + 1}`)}
        className="px-2 py-1 rounded border border-dashed border-gray-600/50 text-gray-500 hover:text-gray-300 hover:border-gray-500 text-xs transition-colors"
      >
        + add group
      </button>
    </div>
  );
}

interface DraggablePoolChampionProps {
  championId: string;
}

function DraggablePoolChampion({ championId }: DraggablePoolChampionProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: `pool:${championId}` });

  const style = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="cursor-grab active:cursor-grabbing"
    >
      <ChampionIcon championId={championId} size="lg" />
    </div>
  );
}

// Official LoL position icons from Community Dragon
const ROLE_ICON_URLS: Record<Role, string> = {
  top: "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-top.png",
  jungle: "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-jungle.png",
  mid: "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-middle.png",
  adc: "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-bottom.png",
  support: "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-utility.png",
};

function RoleIcon({ role, className = "w-5 h-5" }: { role: Role; className?: string }) {
  return (
    <img
      src={ROLE_ICON_URLS[role]}
      alt={role}
      className={`${className} object-contain`}
    />
  );
}

const ROLE_LABELS: Record<Role, string> = {
  top: "Top",
  jungle: "Jungle",
  mid: "Mid",
  adc: "ADC",
  support: "Support",
};

interface ChampionPoolSectionProps {
  excludeIds: string[];
}

function ChampionPoolSection({ excludeIds, isOver }: ChampionPoolSectionProps & { isOver?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<Role[]>([]);
  const { champions } = useChampionData();

  const { setNodeRef } = useDroppable({
    id: "pool",
  });

  const toggleRole = (role: Role) => {
    setSelectedRoles((prev) =>
      prev.includes(role)
        ? prev.filter((r) => r !== role)
        : [...prev, role]
    );
  };

  const availableChampions = champions
    .filter((c) => !excludeIds.includes(c.id))
    .filter((c) => !query || c.name.toLowerCase().includes(query.toLowerCase()))
    .filter((c) => {
      if (selectedRoles.length === 0) return true;
      const champRoles = getChampionRoles(c.id);
      return selectedRoles.some((role) => champRoles.includes(role));
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Card
      ref={setNodeRef}
      variant="bordered"
      className={`p-4 transition-colors ${isOver ? "border-lol-gold bg-lol-gold/10" : ""}`}
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
      >
        <span
          className={`transition-transform ${isOpen ? "rotate-90" : ""}`}
        >
          ▶
        </span>
        <span>{isOpen ? "Close" : "Show"} Champion Pool</span>
      </button>

      {isOpen && (
        <div className="mt-3 flex flex-col gap-3">
          {/* Search and role filters */}
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search champions..."
              className="w-full max-w-xs px-3 py-1.5 bg-lol-dark border border-lol-border rounded text-white placeholder-gray-500 text-sm focus:outline-none focus:border-lol-gold"
            />
            <div className="flex gap-1">
              {ROLES.map((roleInfo) => {
                const role = roleInfo.value as Role;
                const isSelected = selectedRoles.includes(role);
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => toggleRole(role)}
                    title={ROLE_LABELS[role]}
                    className={`p-1.5 rounded transition-colors ${
                      isSelected
                        ? "bg-lol-gold text-lol-dark"
                        : "bg-lol-dark text-gray-400 hover:text-white hover:bg-lol-surface"
                    }`}
                  >
                    <RoleIcon role={role} />
                  </button>
                );
              })}
            </div>
          </div>
          <span className="text-xs text-gray-400/50">Add champions to groups by dragging</span>
          <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto">
            {availableChampions.map((champion) => (
              <DraggablePoolChampion
                key={champion.id}
                championId={champion.id}
              />
            ))}
          </div>
          {availableChampions.length === 0 && (
            <p className="text-gray-500 text-sm">
              {query || selectedRoles.length > 0 ? "No champions found" : "All champions assigned"}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

function DropPlaceholder() {
  return (
    <div className="w-12 h-12 rounded border-2 border-dashed border-lol-gold/50 bg-lol-gold/10" />
  );
}

interface SortableGroupWrapperProps {
  groupId: string;
  children: React.ReactNode;
}

function SortableGroupWrapper({ groupId, children }: SortableGroupWrapperProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `sortable-group:${groupId}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative">
      <div className="mr-6">{children}</div>
      <div
        {...attributes}
        {...listeners}
        className="absolute right-0 top-0 bottom-0 w-6 flex items-center justify-center cursor-grab active:cursor-grabbing text-gray-600 hover:text-gray-400"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
        </svg>
      </div>
    </div>
  );
}

interface DroppableGroupProps {
  group: ChampionGroup;
  allChampionIds: string[];
  onAddChampion: (championId: string) => void;
  onRemoveChampion: (championId: string) => void;
  onRemoveGroup: () => void;
  onRenameGroup: (newName: string) => void;
  isOver?: boolean;
  activeId: string | null;
  overId: string | null;
}

function DroppableGroup({
  group,
  allChampionIds,
  onAddChampion,
  onRemoveChampion,
  onRemoveGroup,
  onRenameGroup,
  isOver,
  activeId,
  overId,
}: DroppableGroupProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(group.name);

  const { setNodeRef } = useDroppable({
    id: `group:${group.id}`,
  });

  const handleSaveName = () => {
    if (editName.trim()) {
      onRenameGroup(editName.trim());
    }
    setIsEditing(false);
  };

  const handleSelect = (champion: Champion) => {
    onAddChampion(champion.id);
  };

  return (
    <div
      ref={setNodeRef}
      className={`border rounded-lg p-3 bg-lol-dark/50 transition-colors ${
        isOver ? "border-lol-gold bg-lol-gold/10" : "border-lol-border"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        {isEditing ? (
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleSaveName}
            onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
            className="bg-lol-surface border border-lol-border rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-lol-gold"
            autoFocus
          />
        ) : (
          <h4
            className="text-sm font-medium text-gray-300 cursor-pointer hover:text-white inline-flex items-center gap-1.5 group"
            onClick={() => setIsEditing(true)}
          >
            {group.name}
            <svg
              className="w-3 h-3 text-gray-500 group-hover:text-white transition-colors"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </h4>
        )}
        <button
          type="button"
          onClick={onRemoveGroup}
          className="text-gray-500 hover:text-red-400 text-xs"
        >
          Remove
        </button>
      </div>
      <SortableContext
        items={group.championIds.map((id) => `${group.id}:${id}`)}
        strategy={horizontalListSortingStrategy}
      >
        <div className="flex flex-wrap gap-3 items-start min-h-12">
          {(() => {
            // Determine if we should show a placeholder in this group
            const isDragging = activeId !== null;
            const isFromPool = activeId?.startsWith("pool:");
            const isFromDifferentGroup = activeId && !activeId.startsWith("pool:") && !activeId.startsWith(`${group.id}:`);
            const shouldShowPlaceholder = isDragging && (isFromPool || isFromDifferentGroup);

            // Find the target index for the placeholder
            let placeholderIndex = -1;
            if (shouldShowPlaceholder && overId) {
              if (overId === `group:${group.id}`) {
                // Dropped on group directly - show at end
                placeholderIndex = group.championIds.length;
              } else if (overId.startsWith(`${group.id}:`)) {
                // Hovering over a champion in this group
                const overChampionId = overId.split(":")[1];
                placeholderIndex = group.championIds.indexOf(overChampionId);
              }
            }

            const elements: React.ReactNode[] = [];
            group.championIds.forEach((championId, index) => {
              // Add placeholder before this item if needed
              if (placeholderIndex === index) {
                elements.push(<DropPlaceholder key="placeholder" />);
              }
              elements.push(
                <SortableChampion
                  key={championId}
                  championId={championId}
                  groupId={group.id}
                  onRemove={() => onRemoveChampion(championId)}
                />
              );
            });
            // Add placeholder at end if needed
            if (placeholderIndex === group.championIds.length) {
              elements.push(<DropPlaceholder key="placeholder" />);
            }
            return elements;
          })()}
          <AddChampionButton
            onSelect={handleSelect}
            excludeIds={allChampionIds}
          />
        </div>
      </SortableContext>
    </div>
  );
}

// Custom collision detection that prioritizes the container the pointer is within
const customCollisionDetection: CollisionDetection = (args) => {
  // First check pointerWithin to find which container the pointer is actually in
  const pointerCollisions = pointerWithin(args);

  // Find containers the pointer is within
  const poolCollision = pointerCollisions.find(
    (collision) => collision.id === 'pool'
  );

  const groupCollision = pointerCollisions.find(
    (collision) => typeof collision.id === 'string' && collision.id.startsWith('group:')
  );

  const sortableGroupCollision = pointerCollisions.find(
    (collision) => typeof collision.id === 'string' && collision.id.startsWith('sortable-group:')
  );

  // Determine which group container the pointer is in (if any)
  let targetGroupId: string | null = null;
  if (groupCollision) {
    targetGroupId = (groupCollision.id as string).replace('group:', '');
  } else if (sortableGroupCollision) {
    targetGroupId = (sortableGroupCollision.id as string).replace('sortable-group:', '');
  }

  // If pointer is within the pool and not over a pool champion, return pool
  if (poolCollision && !targetGroupId) {
    const isOverPoolChampion = pointerCollisions.some(
      (c) => typeof c.id === 'string' && c.id.startsWith('pool:')
    );
    if (!isOverPoolChampion) {
      return [poolCollision];
    }
  }

  // Get closestCenter collisions for finding items
  const centerCollisions = closestCenter(args);

  // If we're within a group, look for champion items in THAT group only
  if (targetGroupId) {
    const itemInTargetGroup = centerCollisions.find(
      (collision) => {
        const id = collision.id as string;
        if (typeof id !== 'string') return false;
        // Check if this is a champion in the target group
        return id.startsWith(`${targetGroupId}:`);
      }
    );

    // If we found a champion in the target group, return it for precise positioning
    if (itemInTargetGroup) {
      return [itemInTargetGroup];
    }

    // Otherwise return the group container itself
    if (groupCollision) {
      return [groupCollision];
    }
    if (sortableGroupCollision) {
      return [sortableGroupCollision];
    }
  }

  // If not in a group, check if we're in the pool
  if (poolCollision) {
    return [poolCollision];
  }

  // Fallback: return any group collision from centerCollisions
  const centerGroupCollision = centerCollisions.find(
    (collision) => typeof collision.id === 'string' &&
      (collision.id.startsWith('group:') || collision.id.startsWith('sortable-group:'))
  );
  if (centerGroupCollision) {
    return [centerGroupCollision];
  }

  return centerCollisions;
};

export default function PlayerTierList({
  player,
  onAddChampion,
  onRemoveChampion,
  onMoveChampion,
  onReorderChampion,
  onAddGroup,
  onRemoveGroup,
  onRenameGroup,
  onReorderGroups,
}: PlayerTierListProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [overGroupId, setOverGroupId] = useState<string | null>(null);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customGroups, setCustomGroups] = useState<string[]>([""]);
  const [templateName, setTemplateName] = useState("");
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const { templates: customTemplates, addTemplate, removeTemplate } = useCustomTemplatesStore();

  const primaryRole: Role = player.role ?? 'mid';

  const groups = player.championGroups || [];
  const allChampionIds = groups.flatMap((g) => g.championIds);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    if (!over) {
      setOverGroupId(null);
      setOverId(null);
      return;
    }

    const overIdStr = over.id as string;
    setOverId(overIdStr);

    // Check if hovering over the pool
    if (overIdStr === "pool") {
      setOverGroupId("pool");
      return;
    }

    // Check if hovering over a group directly
    if (overIdStr.startsWith("group:")) {
      setOverGroupId(overIdStr.replace("group:", ""));
    } else if (overIdStr.startsWith("sortable-group:")) {
      // Hovering over the sortable group wrapper
      setOverGroupId(overIdStr.replace("sortable-group:", ""));
    } else if (overIdStr.includes(":") && !overIdStr.startsWith("pool:")) {
      // Hovering over a champion - extract its group
      const [groupId] = overIdStr.split(":");
      setOverGroupId(groupId);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setOverId(null);
    setOverGroupId(null);

    if (!over) return;

    const activeIdStr = active.id as string;
    const overIdStr = over.id as string;

    // Check if reordering groups
    if (activeIdStr.startsWith("sortable-group:") && overIdStr.startsWith("sortable-group:")) {
      const activeGroupId = activeIdStr.replace("sortable-group:", "");
      const overGroupId = overIdStr.replace("sortable-group:", "");

      if (activeGroupId !== overGroupId) {
        const oldIndex = groups.findIndex((g) => g.id === activeGroupId);
        const newIndex = groups.findIndex((g) => g.id === overGroupId);
        const newOrder = arrayMove(groups, oldIndex, newIndex).map((g) => g.id);
        onReorderGroups(newOrder);
      }
      return;
    }

    // Check if dragging from the champion pool
    if (activeIdStr.startsWith("pool:")) {
      const championId = activeIdStr.replace("pool:", "");

      // Dropped on a group directly
      if (overIdStr.startsWith("group:")) {
        const targetGroupId = overIdStr.replace("group:", "");
        onAddChampion(targetGroupId, championId);
        return;
      }

      // Dropped on a sortable-group wrapper (treat as dropping on the group)
      if (overIdStr.startsWith("sortable-group:")) {
        const targetGroupId = overIdStr.replace("sortable-group:", "");
        onAddChampion(targetGroupId, championId);
        return;
      }

      // Dropped on a champion in a group
      if (overIdStr.includes(":") && !overIdStr.startsWith("pool:")) {
        const [targetGroupId] = overIdStr.split(":");
        if (targetGroupId) {
          onAddChampion(targetGroupId, championId);
        }
      }
      return;
    }

    // Check if dropped on the pool (remove from group)
    if (overIdStr === "pool") {
      const [groupId, championId] = activeIdStr.split(":");
      if (groupId && championId) {
        onRemoveChampion(groupId, championId);
      }
      return;
    }

    // Parse the active ID: format is "groupId:championId"
    const [activeGroupId, activeChampionId] = activeIdStr.split(":");
    if (!activeGroupId || !activeChampionId) return;

    // Check if dropped on a group directly
    if (overIdStr.startsWith("group:")) {
      const targetGroupId = overIdStr.replace("group:", "");
      if (activeGroupId !== targetGroupId) {
        // Move to end of target group
        const targetGroup = groups.find((g) => g.id === targetGroupId);
        if (targetGroup) {
          onMoveChampion(
            activeGroupId,
            targetGroupId,
            activeChampionId,
            targetGroup.championIds.length,
          );
        }
      }
      return;
    }

    // Check if dropped on a sortable-group wrapper
    if (overIdStr.startsWith("sortable-group:")) {
      const targetGroupId = overIdStr.replace("sortable-group:", "");
      if (activeGroupId !== targetGroupId) {
        // Move to end of target group
        const targetGroup = groups.find((g) => g.id === targetGroupId);
        if (targetGroup) {
          onMoveChampion(
            activeGroupId,
            targetGroupId,
            activeChampionId,
            targetGroup.championIds.length,
          );
        }
      }
      return;
    }

    // Dropped on a champion
    const [overGroupId, overChampionId] = overIdStr.split(":");
    if (!overGroupId) return;

    // If dropped on same item, no change
    if (activeIdStr === overIdStr) return;

    // Find the target group and index
    const targetGroup = groups.find((g) => g.id === overGroupId);
    if (!targetGroup) return;

    const overIndex = overChampionId
      ? targetGroup.championIds.indexOf(overChampionId)
      : targetGroup.championIds.length;

    if (activeGroupId === overGroupId) {
      // Reorder within same group
      onReorderChampion(activeGroupId, activeChampionId, overIndex);
    } else {
      // Move to different group
      onMoveChampion(activeGroupId, overGroupId, activeChampionId, overIndex);
    }
  };

  // Get the champion ID being dragged for overlay
  const activeChampionId = activeId
    ? activeId.startsWith("pool:")
      ? activeId.replace("pool:", "")
      : activeId.startsWith("sortable-group:")
        ? null
        : activeId.split(":")[1]
    : null;

  // Get the group being dragged for overlay
  const activeGroupId = activeId?.startsWith("sortable-group:")
    ? activeId.replace("sortable-group:", "")
    : null;
  const activeGroup = activeGroupId ? groups.find((g) => g.id === activeGroupId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={customCollisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-4">
        <Card variant="bordered" className="p-4">
          {groups.length === 0 ? (
            <div className="py-8 flex items-stretch gap-6">
              {/* Left side - Create empty group */}
              <div className="flex-1 flex flex-col items-center justify-center">
                <p className="text-gray-500 text-xs mb-4">Start from scratch</p>
                <button
                  type="button"
                  onClick={() => onAddGroup("Group 1")}
                  className="px-6 py-4 rounded-lg border-2 border-dashed border-gray-600 text-gray-400 hover:text-white hover:border-lol-gold transition-colors text-sm font-medium"
                >
                  + Create Empty Group
                </button>
              </div>

              {/* Divider */}
              <div className="flex flex-col items-center justify-center">
                <div className="h-full w-px bg-lol-border" />
                <span className="px-2 py-1 text-gray-500 text-xs">or</span>
                <div className="h-full w-px bg-lol-border" />
              </div>

              {/* Right side - Templates or Custom Form */}
              <div className="flex-2 flex flex-col">
                {showCustomForm ? (
                  <>
                    <p className="text-gray-500 text-xs mb-4 text-center">Create your own template</p>
                    <div className="space-y-3 mb-4">
                      <input
                        type="text"
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                        placeholder="Template name"
                        className="w-full px-3 py-2 bg-lol-dark border border-lol-border rounded text-white placeholder-gray-500 text-sm focus:outline-none focus:border-lol-gold"
                      />
                      <div className="space-y-2">
                        {customGroups.map((groupName, index) => (
                          <div key={index} className="flex gap-2">
                            <input
                              type="text"
                              value={groupName}
                              onChange={(e) => {
                                const newGroups = [...customGroups];
                                newGroups[index] = e.target.value;
                                setCustomGroups(newGroups);
                              }}
                              placeholder={`Group ${index + 1}`}
                              className="flex-1 px-3 py-2 bg-lol-dark border border-lol-border rounded text-white placeholder-gray-500 text-sm focus:outline-none focus:border-lol-gold"
                            />
                            {customGroups.length > 1 && (
                              <button
                                type="button"
                                onClick={() => setCustomGroups(customGroups.filter((_, i) => i !== index))}
                                className="px-2 text-gray-500 hover:text-red-400"
                              >
                                ×
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCustomGroups([...customGroups, ""])}
                      className="text-xs text-gray-400 hover:text-white mb-3"
                    >
                      + Add another group
                    </button>
                    <label className="flex items-center gap-2 text-xs text-gray-400 mb-4 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={saveAsTemplate}
                        onChange={(e) => setSaveAsTemplate(e.target.checked)}
                        className="rounded border-lol-border bg-lol-dark"
                      />
                      Save as reusable template
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowCustomForm(false);
                          setCustomGroups([""]);
                          setTemplateName("");
                          setSaveAsTemplate(false);
                        }}
                        className="flex-1 px-4 py-2 rounded border border-lol-border text-gray-400 hover:text-white hover:border-gray-500 text-sm"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const validGroups = customGroups.filter((g) => g.trim());
                          if (validGroups.length > 0) {
                            const trimmedGroups = validGroups.map((g) => g.trim());
                            // Save as template if checkbox is checked and name is provided
                            if (saveAsTemplate && templateName.trim()) {
                              addTemplate(templateName.trim(), trimmedGroups);
                            }
                            // Create the groups
                            trimmedGroups.forEach((groupName) => onAddGroup(groupName));
                            setShowCustomForm(false);
                            setCustomGroups([""]);
                            setTemplateName("");
                            setSaveAsTemplate(false);
                          }
                        }}
                        className="flex-1 px-4 py-2 rounded bg-lol-gold text-lol-dark font-medium text-sm hover:bg-lol-gold/90"
                      >
                        Create Groups
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-gray-500 text-xs mb-4 text-center">Choose a template</p>
                    <div className="grid grid-cols-2 gap-3">
                      {getTemplates(primaryRole).map((template) => (
                        <button
                          key={template.id}
                          type="button"
                          onClick={() => {
                            template.groups.forEach((groupName) => onAddGroup(groupName));
                          }}
                          className="p-3 rounded-lg border border-lol-border bg-lol-surface hover:border-lol-gold hover:bg-lol-gold/5 transition-colors text-left group"
                        >
                          <div className="text-sm font-medium text-white group-hover:text-lol-gold transition-colors">
                            {template.name}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">{template.description}</div>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {template.groups.slice(0, 3).map((g) => (
                              <span key={g} className="text-[10px] px-1.5 py-0.5 rounded bg-lol-dark text-gray-400">
                                {g}
                              </span>
                            ))}
                            {template.groups.length > 3 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-lol-dark text-gray-400">
                                +{template.groups.length - 3}
                              </span>
                            )}
                          </div>
                        </button>
                      ))}
                      {/* Custom templates */}
                      {customTemplates.map((template) => (
                        <div
                          key={template.id}
                          className="p-3 rounded-lg border border-lol-gold/50 bg-lol-surface hover:border-lol-gold hover:bg-lol-gold/5 transition-colors text-left group relative"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              template.groups.forEach((groupName) => onAddGroup(groupName));
                            }}
                            className="w-full text-left"
                          >
                            <div className="text-sm font-medium text-lol-gold group-hover:text-lol-gold-light transition-colors">
                              {template.name}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">Custom template</div>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {template.groups.slice(0, 3).map((g) => (
                                <span key={g} className="text-[10px] px-1.5 py-0.5 rounded bg-lol-dark text-gray-400">
                                  {g}
                                </span>
                              ))}
                              {template.groups.length > 3 && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-lol-dark text-gray-400">
                                  +{template.groups.length - 3}
                                </span>
                              )}
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeTemplate(template.id);
                            }}
                            className="absolute top-2 right-2 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Delete template"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                    <p className="text-gray-500 text-xs mt-4 text-center">
                      Don't like the templates?{" "}
                      <button
                        type="button"
                        onClick={() => setShowCustomForm(true)}
                        className="text-lol-gold hover:underline"
                      >
                        Create your own
                      </button>
                    </p>
                  </>
                )}
              </div>
            </div>
          ) : (
            <SortableContext
              items={groups.map((g) => `sortable-group:${g.id}`)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-4">
                {groups.map((group) => (
                  <SortableGroupWrapper key={group.id} groupId={group.id}>
                    <DroppableGroup
                      group={group}
                      allChampionIds={allChampionIds}
                      onAddChampion={(championId) =>
                        onAddChampion(group.id, championId)
                      }
                      onRemoveChampion={(championId) =>
                        onRemoveChampion(group.id, championId)
                      }
                      onRemoveGroup={() => onRemoveGroup(group.id)}
                      onRenameGroup={(newName) => onRenameGroup(group.id, newName)}
                      isOver={overGroupId === group.id}
                      activeId={activeId}
                      overId={overId}
                    />
                  </SortableGroupWrapper>
                ))}
              </div>
            </SortableContext>
          )}

          {/* Add new group */}
          {groups.length > 0 && (
            <AddGroupButton onAddGroup={onAddGroup} groupCount={groups.length} />
          )}
        </Card>

        <ChampionPoolSection excludeIds={allChampionIds} isOver={overGroupId === "pool"} />
      </div>

      <DragOverlay>
        {activeChampionId ? (
          <div className="opacity-80">
            <ChampionIcon
              championId={activeChampionId}
              size="lg"
              showName={!activeId?.startsWith("pool:")}
            />
          </div>
        ) : activeGroup ? (
          <div className="opacity-80 bg-lol-dark border border-lol-gold rounded-lg p-3 shadow-lg">
            <span className="text-sm font-medium text-gray-300">{activeGroup.name}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
