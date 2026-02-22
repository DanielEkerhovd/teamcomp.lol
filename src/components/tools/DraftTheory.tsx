import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  pointerWithin,
} from "@dnd-kit/core";
import { useDraftTheoryStore } from "../../stores/useDraftTheoryStore";
import { useChampionData } from "../../hooks/useChampionData";
import DraftSide from "./DraftSide";
import DraftChampionPool from "./DraftChampionPool";

type DraftSideType = "blue" | "red";
type SlotType = "ban" | "pick";

interface SlotLocation {
  side: DraftSideType;
  type: SlotType;
  index: number;
}

function parseSlotId(id: string): SlotLocation | null {
  const parts = id.split(":");
  if (parts.length !== 3) return null;
  const [side, type, indexStr] = parts;
  if (side !== "blue" && side !== "red") return null;
  if (type !== "ban" && type !== "pick") return null;
  const index = parseInt(indexStr, 10);
  if (isNaN(index)) return null;
  return { side, type, index };
}

function parsePoolId(id: string): string | null {
  if (!id.startsWith("pool:")) return null;
  return id.replace("pool:", "");
}

export default function DraftTheory() {
  const { getIconUrl, getChampionById } = useChampionData();
  const [activeId, setActiveId] = useState<string | null>(null);

  const {
    blueBans,
    bluePicks,
    redBans,
    redPicks,
    setSlot,
    swapSlots,
    clearSlot,
    clearSide,
    clearAll,
    getAllUsedChampionIds,
  } = useDraftTheoryStore();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeIdStr = active.id as string;
    const overIdStr = over.id as string;

    // Case 1: Dragging from pool to a slot
    const poolChampionId = parsePoolId(activeIdStr);
    if (poolChampionId) {
      const targetSlot = parseSlotId(overIdStr);
      if (targetSlot) {
        setSlot(
          targetSlot.side,
          targetSlot.type,
          targetSlot.index,
          poolChampionId,
        );
      }
      return;
    }

    // Case 2: Dragging from slot
    const fromSlot = parseSlotId(activeIdStr);
    if (fromSlot) {
      // Dropping back to pool - clear the slot
      if (overIdStr === "pool") {
        clearSlot(fromSlot.side, fromSlot.type, fromSlot.index);
        return;
      }

      // Dropping to another slot - swap
      const toSlot = parseSlotId(overIdStr);
      if (toSlot) {
        // Don't swap with itself
        if (
          fromSlot.side === toSlot.side &&
          fromSlot.type === toSlot.type &&
          fromSlot.index === toSlot.index
        ) {
          return;
        }
        swapSlots(fromSlot, toSlot);
      }
    }
  };

  // Get the champion being dragged for the overlay
  const getActiveChampion = () => {
    if (!activeId) return null;

    // Check if it's from pool
    const poolChampionId = parsePoolId(activeId);
    if (poolChampionId) {
      return poolChampionId;
    }

    // Check if it's from a slot
    const slot = parseSlotId(activeId);
    if (slot) {
      const slots =
        slot.side === "blue"
          ? slot.type === "ban"
            ? blueBans
            : bluePicks
          : slot.type === "ban"
            ? redBans
            : redPicks;
      return slots[slot.index];
    }

    return null;
  };

  const activeChampionId = getActiveChampion();
  const activeChampion = activeChampionId
    ? getChampionById(activeChampionId)
    : null;
  const activeIconUrl = activeChampionId ? getIconUrl(activeChampionId) : null;

  const usedChampionIds = getAllUsedChampionIds();

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col h-full">
        <div className="flex gap-6 flex-1 min-h-0">
          {/* Blue Side */}
          <DraftSide
            side="blue"
            bans={blueBans}
            picks={bluePicks}
            onClearSide={() => clearSide("blue")}
          />

          {/* Champion Pool */}
          <div className="flex-1 min-w-0 min-h-0">
            <DraftChampionPool usedChampionIds={usedChampionIds} />
          </div>

          {/* Red Side */}
          <DraftSide
            side="red"
            bans={redBans}
            picks={redPicks}
            onClearSide={() => clearSide("red")}
          />
        </div>
      </div>

      {/* Drag Overlay */}
      <DragOverlay dropAnimation={null}>
        {activeChampion && activeIconUrl && (
          <div className="pointer-events-none size-10">
            <img
              src={activeIconUrl}
              alt={activeChampion.name}
              className="w-full h-full aspect-square rounded-lg border-2 border-lol-gold shadow-lg shadow-lol-gold/30 object-cover"
            />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
