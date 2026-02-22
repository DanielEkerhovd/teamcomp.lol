import { useState, forwardRef, HTMLAttributes } from "react";
import { Player, ROLES, REGIONS } from "../../types";
import { useOpgg } from "../../hooks/useOpgg";
import { ChampionIcon } from "../champion";
import RankBadge from "./RankBadge";

interface PlayerCardProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "onChange"
> {
  player: Player;
  onChange: (updates: Partial<Omit<Player, "id">>) => void;
  onEditChampions?: () => void;
  showOpggLink?: boolean;
  compact?: boolean;
  isDragging?: boolean;
  showRole?: boolean;
  dragHandleProps?: HTMLAttributes<HTMLDivElement>;
}

const PlayerCard = forwardRef<HTMLDivElement, PlayerCardProps>(
  (
    {
      player,
      onChange,
      showOpggLink = true,
      compact = false,
      isDragging = false,
      showRole = true,
      dragHandleProps,
      className = "",
      ...props
    },
    ref,
  ) => {
    const [showNotes, setShowNotes] = useState(false);
    const { openPlayerProfile } = useOpgg();

    const roleLabel =
      ROLES.find((r) => r.value === player.role)?.label || player.role;

    return (
      <div
        ref={ref}
        className={`bg-lol-card rounded-xl border border-lol-border/50 px-3 py-2.5 flex-1 transition-all duration-200 h-38 flex flex-col ${
          isDragging ? "opacity-50" : "hover:bg-lol-card-hover hover:border-lol-border-light"
        } ${className}`}
        {...props}
      >
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1">
            {dragHandleProps && (
              <div
                {...dragHandleProps}
                className="cursor-grab text-gray-600 hover:text-lol-gold select-none transition-colors"
              >
                ⋮⋮
              </div>
            )}
            {showRole && (
              <span className="font-semibold text-lol-gold">{roleLabel}</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {showOpggLink && player.summonerName && (
              <button
                type="button"
                onClick={() => openPlayerProfile(player)}
                className="text-[10px] text-gray-500 hover:text-lol-gold transition-colors px-1.5 py-0.5 rounded hover:bg-lol-gold/10"
                title="Open OP.GG"
              >
                OP.GG
              </button>
            )}
            {!compact && (
              <button
                type="button"
                onClick={() => setShowNotes(!showNotes)}
                className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                  showNotes || player.notes
                    ? "text-lol-gold bg-lol-gold/10"
                    : "text-gray-500 hover:text-gray-300 hover:bg-lol-surface"
                }`}
                title="Toggle notes"
              >
                {player.notes ? "📝" : "+"}
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-col my-auto">
          <input
            value={player.summonerName}
            onChange={(e) => onChange({ summonerName: e.target.value })}
            placeholder="Name"
            className="w-full bg-transparent text-white text-sm placeholder-gray-600 focus:outline-none border-b border-transparent focus:border-lol-gold/30 transition-colors"
          />
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-gray-500 text-xs">#</span>
            <input
              value={player.tagLine}
              onChange={(e) => onChange({ tagLine: e.target.value })}
              placeholder="Tag"
              className="flex-1 bg-transparent text-gray-400 text-xs placeholder-gray-600 focus:outline-none focus:text-white transition-colors"
            />
            <select
              value={player.region}
              onChange={(e) =>
                onChange({ region: e.target.value as Player["region"] })
              }
              className={`bg-lol-surface text-gray-500 focus:outline-none cursor-pointer hover:text-gray-300 transition-colors rounded ${
                compact ? 'text-[10px] px-1 py-0.5' : 'text-xs bg-transparent'
              }`}
            >
              {REGIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.value.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          {player.summonerName && player.tagLine && (
            <div className="mt-1.5">
              <RankBadge player={player} compact={compact} />
            </div>
          )}

          {player.championPool && player.championPool.length > 0 && (
            <div className="flex items-center gap-1 mt-2 flex-wrap">
              {player.championPool.slice(0, compact ? 3 : 5).map((champ) => (
                <ChampionIcon
                  key={champ.championId}
                  championId={champ.championId}
                  size="xs"
                />
              ))}
              {player.championPool.length > (compact ? 3 : 5) && (
                <span className="text-[10px] text-gray-500 ml-0.5 bg-lol-surface px-1.5 py-0.5 rounded">
                  +{player.championPool.length - (compact ? 3 : 5)}
                </span>
              )}
            </div>
          )}
        </div>
        {showNotes && !compact && (
          <textarea
            value={player.notes}
            onChange={(e) => onChange({ notes: e.target.value })}
            placeholder="Notes..."
            className="w-full mt-2 px-2 py-1.5 bg-lol-dark border border-lol-border rounded-lg text-white placeholder-gray-600 text-xs resize-none focus:outline-none focus:border-lol-gold/50 focus:ring-1 focus:ring-lol-gold/20 transition-all"
            rows={2}
          />
        )}
      </div>
    );
  },
);

PlayerCard.displayName = "PlayerCard";

export default PlayerCard;
