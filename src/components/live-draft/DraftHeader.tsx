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
          activeBorder: "border-blue-400/30",
          icon: "text-blue-400/50",
          readyBorder: "border-green-400/60",
          readyGlow: "shadow-[0_0_12px_rgba(74,222,128,0.3)]",
          readyBg: "bg-green-500/5",
        }
      : {
          text: "text-red-400/70",
          bg: "bg-red-400/10",
          activeBorder: "border-red-400/30",
          icon: "text-red-400/50",
          readyBorder: "border-green-400/60",
          readyGlow: "shadow-[0_0_12px_rgba(74,222,128,0.3)]",
          readyBg: "bg-green-500/5",
        };

  const borderClass = isReady
    ? `${c.readyBorder} ${c.readyGlow}`
    : isActive
      ? `${c.activeBorder} scale-[1.02]`
      : "border-lol-border";

  const bgClass = isReady ? c.readyBg : "bg-lol-card";

  return (
    <div
      className={`
        flex-1 px-3 py-1.5 rounded-lg border transition-all duration-300
        ${borderClass} ${bgClass}
      `}
    >
      <div
        className={`flex items-center justify-center gap-3 h-full ${side === "red" ? "flex-row-reverse text-right" : ""}`}
      >
        {/* Avatar */}
        {team.captainAvatarUrl ? (
          <img
            src={team.captainAvatarUrl}
            alt=""
            className="w-8 h-8 rounded-full shrink-0"
          />
        ) : (
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${c.bg}`}
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
                <span className="text-lol-gold">
                  {formatRole(team.captainRole)}
                  {team.captainRoleTeamName &&
                    ` of ${team.captainRoleTeamName}`}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Ready checkmark indicator */}
        {isReady && (
          <div className="shrink-0">
            <div className="w-7 h-7 rounded-full bg-green-500/20 border border-green-400/50 flex items-center justify-center">
              <svg
                className="w-4 h-4 text-green-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
          </div>
        )}

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

export default function DraftHeader({
  blueTeam,
  redTeam,
  currentTurn,
  timerRemaining,
  showReadyState,
}: DraftHeaderProps) {
  const isUrgent = timerRemaining !== null && timerRemaining <= 10;
  const isCritical = timerRemaining !== null && timerRemaining <= 5;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return `${mins}:${secs.toString().padStart(2, "0")}`;
    }
    return `${secs}`;
  };

  return (
    <div className="flex items-stretch gap-4 px-4 py-2 bg-lol-card border-b border-lol-border">
      {/* Blue Team Card */}
      <TeamCard team={blueTeam} side="blue" isActive={currentTurn === "blue"} showReady={showReadyState} />

      {/* Center - Timer */}
      <div className="flex flex-col items-center justify-center min-w-[1000px] gap-0.5">
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
          <div className="text-sm text-gray-500 font-medium animate-pulse">
            Waiting for captains...
          </div>
        ) : null}
      </div>

      {/* Red Team Card */}
      <TeamCard team={redTeam} side="red" isActive={currentTurn === "red"} showReady={showReadyState} />
    </div>
  );
}
