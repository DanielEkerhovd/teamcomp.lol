import { useState, useRef, useEffect } from "react";
import DraftSlot from "./DraftSlot";
import BanSection from "./BanSection";
import { useDraftTheoryStore } from "../../stores/useDraftTheoryStore";

interface DraftSideProps {
  side: "blue" | "red";
  bans: (string | null)[];
  picks: (string | null)[];
  onClearSide: () => void;
}

export default function DraftSide({
  side,
  bans,
  picks,
  onClearSide,
}: DraftSideProps) {
  const teamName = useDraftTheoryStore((state) =>
    side === "blue" ? state.blueTeamName : state.redTeamName,
  );
  const setTeamName = useDraftTheoryStore((state) => state.setTeamName);
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const pickPrefix = side === "blue" ? "B" : "R";

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const sideColors = {
    blue: {
      headerBg: "bg-blue-500/20",
      headerBorder: "border-blue-500/30",
      headerText: "text-blue-400",
    },
    red: {
      headerBg: "bg-red-500/20",
      headerBorder: "border-red-500/30",
      headerText: "text-red-400",
    },
  };

  const colors = sideColors[side];

  return (
    <div className="flex flex-col items-center gap-4 w-80 h-full">
      {/* Header */}
      <div
        className={`px-3 py-2 rounded-lg w-full ${colors.headerBg} border ${colors.headerBorder}`}
      >
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={teamName}
            onChange={(e) => setTeamName(side, e.target.value)}
            onBlur={() => setIsEditing(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === "Escape") {
                setIsEditing(false);
              }
            }}
            className={`text-sm font-semibold ${colors.headerText} bg-transparent border-none outline-none w-full ${side === "red" ? "text-right" : ""}`}
          />
        ) : (
          <h3
            onClick={() => setIsEditing(true)}
            className={`text-sm font-semibold ${colors.headerText} cursor-pointer hover:opacity-80 ${side === "red" ? "text-right" : ""}`}
          >
            {teamName}
          </h3>
        )}
      </div>

      {/* Bans Section */}
      <BanSection side={side} bans={bans} />

      {/* Picks Section */}
      <div className="space-y-2 my-auto">
        <div className="flex flex-col gap-2 items-center justify-center">
          {[0, 1, 2, 3, 4].map((index) => (
            <div
              key={`pick-${index}`}
              className={`flex items-center gap-2 ${side === "red" ? "flex-row-reverse" : ""}`}
            >
              <span className="text-xs text-gray-500 w-6 font-mono">
                {pickPrefix}
                {index + 1}
              </span>
              <DraftSlot
                id={`${side}:pick:${index}`}
                championId={picks[index]}
                side={side}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Clear Side Button */}
      <button
        onClick={onClearSide}
        className="mt-auto px-3 py-1.5 text-xs text-gray-400 hover:text-white bg-lol-dark hover:bg-lol-surface rounded-lg border border-lol-border transition-colors"
      >
        Clear Side
      </button>
    </div>
  );
}
