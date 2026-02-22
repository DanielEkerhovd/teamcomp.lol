import DraftSlot from "./DraftSlot";

interface BanSectionProps {
  side: "blue" | "red";
  bans: (string | null)[];
  slotSize?: string;
}

export default function BanSection({
  side,
  bans,
  slotSize = "size-10",
}: BanSectionProps) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs text-gray-500 uppercase tracking-wide">Bans</h4>
      <div className="flex gap-4">
        {/* First ban phase - 3 bans */}
        <div className="flex gap-2">
          {[0, 1, 2].map((index) => (
            <DraftSlot
              key={`ban-${index}`}
              id={`${side}:ban:${index}`}
              championId={bans[index]}
              side={side}
              size={slotSize}
            />
          ))}
        </div>
        {/* Second ban phase - 2 bans */}
        <div className="flex gap-2">
          {[3, 4].map((index) => (
            <DraftSlot
              key={`ban-${index}`}
              id={`${side}:ban:${index}`}
              championId={bans[index]}
              side={side}
              size={slotSize}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
