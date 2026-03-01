import type { DraftSide } from "../../types/liveDraft";

interface TeamCardInfo {
  name: string;
  captainName: string | null;
  captainAvatarUrl: string | null;
  captainRole: string | null;
  captainRoleTeamName: string | null;
  isReady?: boolean;
}

interface DraftHeaderProps {
  blueTeam: TeamCardInfo;
  redTeam: TeamCardInfo;
  currentTurn: DraftSide | null;
  timerRemaining: number | null;
  showReadyState?: boolean;
  // Side picking props (games 2+)
  isSidePicking?: boolean;
  isCaptain?: boolean;
  mySide?: DraftSide | null;
  onSelectSide?: (side: DraftSide) => void;
  onClearSide?: () => void;
  sidePickingLoading?: boolean;
  isBlueSideTaken?: boolean;
  isRedSideTaken?: boolean;
}

function formatRole(role: string) {
  return role
    .split("_")
    .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function TeamCard({
  team,
  side,
  isActive,
  showReady,
}: {
  team: TeamCardInfo;
  side: DraftSide;
  isActive: boolean;
  showReady?: boolean;
}) {
  const isReady = showReady && team.isReady;

  const c =
    side === "blue"
      ? {
          text: "text-blue-400/70",
          bg: "bg-blue-400/10",
          activeBorder: "border-blue-400",
          activeBg: "bg-blue-500/20",
          activeGlow: "shadow-[0_0_16px_rgba(96,165,250,0.35)]",
          icon: "text-blue-400/50",
          readyBorder: "border-green-400/60",
          readyGlow: "shadow-[0_0_12px_rgba(74,222,128,0.3)]",
          readyBg: "bg-green-500/5",
        }
      : {
          text: "text-red-400/70",
          bg: "bg-red-400/10",
          activeBorder: "border-red-400",
          activeBg: "bg-red-500/20",
          activeGlow: "shadow-[0_0_16px_rgba(248,113,113,0.35)]",
          icon: "text-red-400/50",
          readyBorder: "border-green-400/60",
          readyGlow: "shadow-[0_0_12px_rgba(74,222,128,0.3)]",
          readyBg: "bg-green-500/5",
        };

  const borderClass = isReady
    ? `${c.readyBorder} ${c.readyGlow}`
    : isActive
      ? `${c.activeBorder} ${c.activeGlow} scale-[1.02]`
      : "border-lol-border";

  const bgClass = isReady ? c.readyBg : isActive ? c.activeBg : "bg-lol-card";

  return (
    <div
      className={`
        flex-1 max-w-80 px-3 py-1.5 rounded-lg border transition-all duration-300
        ${borderClass} ${bgClass}
      `}
    >
      <div
        className={`flex items-center justify-center gap-3 h-full ${side === "red" ? "flex-row-reverse text-right" : ""}`}
      >
        {/* Avatar with ready badge overlay */}
        <div className="relative shrink-0">
          {team.captainAvatarUrl ? (
            <img
              src={team.captainAvatarUrl}
              alt=""
              className="w-8 h-8 rounded-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${c.bg}`}
            >
              <svg
                className={`w-5 h-5 ${c.icon}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
          )}
          {isReady && (
            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-green-500 border-2 border-lol-card flex items-center justify-center">
              <svg
                className="w-2.5 h-2.5 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={3}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          {/* Side + Team name */}
          <div
            className={`text-[10px] font-bold uppercase tracking-wider ${c.text}`}
          >
            {side} Side
          </div>
          <div className="text-white font-bold text-sm leading-tight truncate">
            {team.name}
          </div>
          {/* Captain info */}
          {team.captainName && (
            <div className="text-xs text-gray-400 truncate flex flex-col">
              {team.captainName}
              {team.captainRole && (
                <span className="text-lol-gold truncate">
                  {formatRole(team.captainRole)}
                  {team.captainRoleTeamName &&
                    ` of ${team.captainRoleTeamName}`}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Turn indicator (only when not in ready phase) */}
        {isActive && !showReady && (
          <div className={`shrink-0 ${c.icon}`}>
            <svg
              className="w-6 h-6 animate-pulse"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d={side === "blue" ? "M8 5v14l11-7z" : "M16 19V5l-11 7z"} />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}

function SidePickerCard({
  side,
  isCaptain,
  isSelected,
  isOtherSelected,
  onClick,
  onClear,
  loading,
  team,
}: {
  side: DraftSide;
  isCaptain: boolean;
  isSelected: boolean;
  isOtherSelected: boolean;
  onClick: () => void;
  onClear: () => void;
  loading: boolean;
  team: TeamCardInfo | null;
}) {
  const isBlue = side === "blue";
  const c = isBlue
    ? {
        border: "border-blue-500/40",
        selectedBorder: "border-blue-500",
        bg: "hover:bg-blue-500/15",
        selectedBg: "bg-blue-500/20",
        text: "text-blue-400",
        subtext: "text-blue-400/60",
        icon: "text-blue-400/50",
      }
    : {
        border: "border-red-500/40",
        selectedBorder: "border-red-500",
        bg: "hover:bg-red-500/15",
        selectedBg: "bg-red-500/20",
        text: "text-red-400",
        subtext: "text-red-400/60",
        icon: "text-red-400/50",
      };

  // When this side is selected by the current captain — show team info with change button
  if (isSelected && team) {
    const isReady = !!team.isReady;
    const borderClass = isReady
      ? "border-green-400/60 shadow-[0_0_12px_rgba(74,222,128,0.3)]"
      : `${c.selectedBorder}`;
    const bgClass = isReady ? "bg-green-500/5" : c.selectedBg;
    return (
      <div
        className={`
          flex-1 max-w-80 px-3 py-1.5 rounded-lg border-2 transition-all duration-300
          ${borderClass} ${bgClass}
        `}
      >
        <div
          className={`flex items-center justify-center gap-3 h-full ${side === "red" ? "flex-row-reverse text-right" : ""}`}
        >
          {/* Avatar */}
          <div className="relative shrink-0">
            {team.captainAvatarUrl ? (
              <img
                src={team.captainAvatarUrl}
                alt=""
                className="w-8 h-8 rounded-full"
              />
            ) : (
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${isBlue ? "bg-blue-400/10" : "bg-red-400/10"}`}
              >
                <svg
                  className={`w-5 h-5 ${c.icon}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </div>
            )}
            {isReady && (
              <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-green-500 border-2 border-lol-card flex items-center justify-center">
                <svg
                  className="w-2.5 h-2.5 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div
              className={`text-[10px] font-bold uppercase tracking-wider ${c.text}`}
            >
              {side} Side
            </div>
            <div className="text-white font-bold text-sm leading-tight truncate">
              {team.name}
            </div>
            {team.captainName && (
              <div className="text-xs text-gray-400 truncate flex flex-col">
                {team.captainName}
                {team.captainRole && (
                  <span className="text-lol-gold truncate">
                    {formatRole(team.captainRole)}
                    {team.captainRoleTeamName &&
                      ` of ${team.captainRoleTeamName}`}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Leave button — only for captains */}
          {isCaptain && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              disabled={loading}
              className="shrink-0 p-1 rounded hover:bg-white/10 text-gray-500 hover:text-gray-300 transition-all"
              title="Leave side"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
            </button>
          )}
        </div>
      </div>
    );
  }

  // When opposite side is selected by the other captain — show their team info
  if (isOtherSelected && team) {
    const isReady = !!team.isReady;
    const borderClass = isReady
      ? "border-green-400/60 shadow-[0_0_12px_rgba(74,222,128,0.3)]"
      : `${c.selectedBorder}`;
    const bgClass = isReady ? "bg-green-500/5" : c.selectedBg;
    return (
      <div
        className={`
          flex-1 max-w-80 px-3 py-1.5 rounded-lg border-2 transition-all duration-300
          ${borderClass} ${bgClass}
        `}
      >
        <div
          className={`flex items-center justify-center gap-3 h-full ${side === "red" ? "flex-row-reverse text-right" : ""}`}
        >
          <div className="relative shrink-0">
            {team.captainAvatarUrl ? (
              <img
                src={team.captainAvatarUrl}
                alt=""
                className="w-8 h-8 rounded-full"
              />
            ) : (
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${isBlue ? "bg-blue-400/10" : "bg-red-400/10"}`}
              >
                <svg
                  className={`w-5 h-5 ${c.icon}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </div>
            )}
            {isReady && (
              <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-green-500 border-2 border-lol-card flex items-center justify-center">
                <svg
                  className="w-2.5 h-2.5 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div
              className={`text-[10px] font-bold uppercase tracking-wider ${c.text}`}
            >
              {side} Side
            </div>
            <div className="text-white font-bold text-sm leading-tight truncate">
              {team.name}
            </div>
            {team.captainName && (
              <div className="text-xs text-gray-400 truncate flex flex-col">
                {team.captainName}
                {team.captainRole && (
                  <span className="text-lol-gold truncate">
                    {formatRole(team.captainRole)}
                    {team.captainRoleTeamName &&
                      ` of ${team.captainRoleTeamName}`}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Default: empty side picker card
  return (
    <button
      onClick={onClick}
      disabled={!isCaptain || loading}
      className={`
        flex-1 max-w-80 px-3 py-1.5 rounded-lg border-2 border-dashed transition-all duration-300
        ${c.border} bg-lol-card
        ${isCaptain && !loading ? `cursor-pointer ${c.bg}` : "cursor-default"}
        disabled:opacity-60
      `}
    >
      <div className="flex flex-col items-center justify-center gap-1 h-full min-h-[52px]">
        {loading ? (
          <svg
            className={`animate-spin h-5 w-5 ${c.text}`}
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : (
          <>
            <span className={`text-sm font-bold ${c.text}`}>
              {isBlue ? "Blue Side" : "Red Side"}
            </span>
            <span className={`text-[10px] ${c.subtext}`}>
              {isCaptain
                ? isBlue
                  ? "Click to pick blue"
                  : "Click to pick red"
                : "Waiting..."}
            </span>
          </>
        )}
      </div>
    </button>
  );
}

export default function DraftHeader({
  blueTeam,
  redTeam,
  currentTurn,
  timerRemaining,
  showReadyState,
  isSidePicking,
  isCaptain = false,
  mySide,
  onSelectSide,
  onClearSide,
  sidePickingLoading,
  isBlueSideTaken,
  isRedSideTaken,
}: DraftHeaderProps) {
  const isUrgent = timerRemaining !== null && timerRemaining <= 10;
  const isCritical = timerRemaining !== null && timerRemaining <= 5;

  const formatTime = (seconds: number) => {
    return seconds.toString();
  };

  const showSidePicker = isSidePicking && showReadyState;

  return (
    <div className="flex items-stretch gap-4 px-4 py-2 bg-lol-card border-b border-lol-border">
      {/* Blue Side */}
      {showSidePicker ? (
        <SidePickerCard
          side="blue"
          isCaptain={isCaptain}
          isSelected={mySide === "blue"}
          isOtherSelected={!!(isBlueSideTaken && mySide !== "blue")}
          onClick={() => onSelectSide?.("blue")}
          onClear={() => onClearSide?.()}
          loading={!!sidePickingLoading}
          team={isBlueSideTaken ? blueTeam : null}
        />
      ) : (
        <TeamCard team={blueTeam} side="blue" isActive={currentTurn === "blue"} showReady={showReadyState} />
      )}

      {/* Center - Timer */}
      <div className="flex flex-col items-center justify-center flex-1 min-w-0 gap-0.5">
        {timerRemaining !== null ? (
          <div
            className={`
              text-5xl font-bold tabular-nums leading-none
              ${isCritical ? "text-red-500 animate-pulse" : isUrgent ? "text-orange-400" : "text-white"}
            `}
          >
            {formatTime(timerRemaining)}
          </div>
        ) : showReadyState ? (
          <div className="text-sm text-gray-300 font-medium animate-pulse">
            {showSidePicker && !isBlueSideTaken && !isRedSideTaken
              ? "Captains picking sides..."
              : "Waiting for captains..."}
          </div>
        ) : null}
      </div>

      {/* Red Side */}
      {showSidePicker ? (
        <SidePickerCard
          side="red"
          isCaptain={isCaptain}
          isSelected={mySide === "red"}
          isOtherSelected={!!(isRedSideTaken && mySide !== "red")}
          onClick={() => onSelectSide?.("red")}
          onClear={() => onClearSide?.()}
          loading={!!sidePickingLoading}
          team={isRedSideTaken ? redTeam : null}
        />
      ) : (
        <TeamCard team={redTeam} side="red" isActive={currentTurn === "red"} showReady={showReadyState} />
      )}
    </div>
  );
}
