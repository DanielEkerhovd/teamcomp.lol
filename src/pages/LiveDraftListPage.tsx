import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card } from "../components/ui";
import Modal from "../components/ui/Modal";
import CreateSessionModal from "../components/live-draft/CreateSessionModal";
import { liveDraftService } from "../lib/liveDraftService";
import { useAuthStore } from "../stores/useAuthStore";
import type { DraftMode, LiveDraftSession } from "../types/liveDraft";

export default function LiveDraftListPage() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [sessions, setSessions] = useState<LiveDraftSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    async function loadSessions() {
      if (!user) {
        setIsLoading(false);
        return;
      }
      try {
        const userSessions = await liveDraftService.getUserSessions();
        setSessions(userSessions);
      } catch (err) {
        console.error("Failed to load sessions:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadSessions();
  }, [user]);

  const activeSessions = sessions.filter(
    (s) =>
      s.status === "lobby" ||
      s.status === "in_progress" ||
      s.status === "paused",
  );
  const pastSessions = sessions.filter(
    (s) => s.status === "completed" || s.status === "cancelled",
  );

  const [sessionToHide, setSessionToHide] = useState<LiveDraftSession | null>(
    null,
  );
  const [isHiding, setIsHiding] = useState(false);
  const [pastSearch, setPastSearch] = useState("");
  const [pastModeFilter, setPastModeFilter] = useState<DraftMode | "all">(
    "all",
  );

  const filteredPastSessions = pastSessions.filter((s) => {
    if (pastModeFilter !== "all" && s.draft_mode !== pastModeFilter)
      return false;
    if (!pastSearch.trim()) return true;
    const q = pastSearch.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.team1_name.toLowerCase().includes(q) ||
      s.team2_name.toLowerCase().includes(q)
    );
  });

  const handleSessionClick = (session: LiveDraftSession) => {
    navigate(`/live-draft/lobby/${session.id}`);
  };

  const handleHideSession = async () => {
    if (!sessionToHide) return;
    setIsHiding(true);
    try {
      await liveDraftService.hideSession(sessionToHide.id);
      setSessions((prev) => prev.filter((s) => s.id !== sessionToHide.id));
      setSessionToHide(null);
    } catch (err) {
      console.error("Failed to hide session:", err);
    } finally {
      setIsHiding(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button onClick={() => setIsCreateModalOpen(true)} size="lg">
          + New Live Draft
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-white">Live Draft</h1>
          <p className="text-gray-400 mt-1">
            Create and manage real-time draft sessions
          </p>
        </div>
      </div>

      {/* Info Card */}
      <Card className="!bg-gradient-to-br from-lol-gold/5 to-transparent !border-lol-gold/20">
        <div className="flex gap-6">
          <div className="shrink-0">
            <div className="w-16 h-16 rounded-2xl bg-lol-gold/10 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-lol-gold"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            </div>
          </div>
          <div className="space-y-3">
            <h2 className="text-xl font-semibold text-white">
              Real-time Collaborative Drafting
            </h2>
            <p className="text-gray-400">
              Create live draft sessions for scrimmages, tournaments, or
              practice. Invite your opponent as captain and spectators to watch.
              Supports multiple draft modes and multi-game series.
            </p>
            <div className="flex flex-wrap gap-3">
              <FeatureBadge
                icon={
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
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                }
                label="teamcomp.lol Data Integration"
              />
              <FeatureBadge
                icon={
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
                      d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
                    />
                  </svg>
                }
                label="Fearless Draft"
              />
              <FeatureBadge
                icon={
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
                      d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
                    />
                  </svg>
                }
                label="Ironman Draft"
              />
              <FeatureBadge
                icon={
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
                      d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                    />
                  </svg>
                }
                label="Multi-game Series"
              />
              <FeatureBadge
                icon={
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
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                }
                label="Spectator Mode"
              />
              <FeatureBadge
                icon={
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
                      d="M9 19v-6a2 2 0 012-2h6M9 19h6m-6 0l3.553 3.553a1 1 0 001.414 0L21 19m-6-10h2a2 2 0 012 2v6M9 10h2a2 2 0 012 2v6m-6-12h.01M15 4h.01"
                    />
                  </svg>
                }
                label="Chat Integration"
              />
              <FeatureBadge
                icon={
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                  >
                    <path
                      d="M5 10a6 6 0 0 1 11.671-1.963A6 6 0 0 1 16 20H7a5 5 0 0 1-1.986-9.59A6.071 6.071 0 0 1 5 10zm6-4a4 4 0 0 0-3.903 4.879 1 1 0 0 1-.757 1.194A3.002 3.002 0 0 0 7 18h9a4 4 0 1 0-.08-8 1 1 0 0 1-1-.8A4.002 4.002 0 0 0 11 6z"
                      fill="#0D0D0D"
                    />
                  </svg>
                }
                label="Cloud Saved Sessions"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Active Drafts Section */}
      {user && activeSessions.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Active Drafts
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeSessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                onClick={() => handleSessionClick(session)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Past Drafts Section */}
      {user && pastSessions.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-400">Past Drafts</h2>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                placeholder="Search past drafts..."
                value={pastSearch}
                onChange={(e) => setPastSearch(e.target.value)}
                className="pl-9 pr-3 py-1.5 text-sm rounded-lg bg-lol-surface border border-lol-border text-gray-200 placeholder-gray-500 focus:outline-none focus:border-lol-gold/50 w-64"
              />
            </div>
            <div className="flex items-center gap-1">
              {(
                [
                  { value: "all", label: "All", color: "text-gray-300" },
                  { value: "normal", label: "Normal", color: "text-blue-400" },
                  {
                    value: "fearless",
                    label: "Fearless",
                    color: "text-yellow-400",
                  },
                  { value: "ironman", label: "Ironman", color: "text-red-400" },
                ] as const
              ).map((mode) => (
                <button
                  key={mode.value}
                  onClick={() => setPastModeFilter(mode.value)}
                  className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                    pastModeFilter === mode.value
                      ? `${mode.color} bg-white/5 border-current`
                      : "text-gray-500 border-transparent hover:text-gray-300 hover:bg-white/5"
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPastSessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                onClick={() => handleSessionClick(session)}
                onHide={() => setSessionToHide(session)}
                isPast
              />
            ))}
          </div>
          {filteredPastSessions.length === 0 && (
            <p className="text-gray-500 text-sm text-center py-4">
              {pastSearch.trim()
                ? `No past drafts matching "${pastSearch}"${pastModeFilter !== "all" ? ` in ${pastModeFilter} mode` : ""}`
                : `No ${pastModeFilter !== "all" ? pastModeFilter + " " : ""}past drafts`}
            </p>
          )}
        </div>
      )}

      {/* Empty State / Getting Started */}
      {(!user || sessions.length === 0) && (
        <Card className="text-center py-16">
          <div className="text-gray-500 mb-4">
            <svg
              className="w-16 h-16 mx-auto"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">
            Start a Live Draft
          </h2>
          <p className="text-gray-400 mb-6 max-w-md mx-auto">
            Create a new session to draft against your opponent in real-time. No
            account required - just share the invite link.
          </p>
          <Button onClick={() => setIsCreateModalOpen(true)} size="lg">
            Create Live Draft Session
          </Button>
        </Card>
      )}

      {/* Loading State */}
      {isLoading && user && (
        <Card className="text-center py-8">
          <div className="animate-spin w-8 h-8 border-2 border-lol-gold border-t-transparent rounded-full mx-auto" />
          <p className="text-gray-400 mt-4">Loading your drafts...</p>
        </Card>
      )}

      {/* Create Session Modal */}
      <CreateSessionModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />

      {/* Hide Session Confirmation Modal */}
      <Modal
        isOpen={!!sessionToHide}
        onClose={() => setSessionToHide(null)}
        title="Leave Draft"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-300">
            This will remove{" "}
            <span className="text-white font-medium">
              {sessionToHide?.name}
            </span>{" "}
            from your draft list.
          </p>
          <p className="text-gray-400 text-sm">
            The draft data is not deleted — other participants can still access
            it.
          </p>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="ghost" onClick={() => setSessionToHide(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleHideSession}
              disabled={isHiding}
            >
              {isHiding ? "Removing..." : "Leave Draft"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function FeatureBadge({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-lol-surface border border-lol-border text-sm text-gray-300">
      <span className="text-lol-gold">{icon}</span>
      {label}
    </div>
  );
}

function SessionCard({
  session,
  onClick,
  onHide,
  isPast = false,
}: {
  session: LiveDraftSession;
  onClick: () => void;
  onHide?: () => void;
  isPast?: boolean;
}) {
  const statusColors: Record<string, string> = {
    lobby: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    in_progress: "bg-green-500/20 text-green-400 border-green-500/30",
    paused: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    completed: "bg-gray-500/20 text-gray-400 border-gray-500/30",
    cancelled: "bg-red-500/20 text-red-400 border-red-500/30",
  };

  const statusLabels: Record<string, string> = {
    lobby: "In Lobby",
    in_progress: "Live",
    paused: "Paused",
    completed: "Completed",
    cancelled: "Cancelled",
  };

  const modeColors: Record<string, string> = {
    normal: "text-blue-400",
    fearless: "text-yellow-400",
    ironman: "text-red-400",
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Card
      className={`cursor-pointer transition-all hover:scale-[1.02] hover:border-lol-gold/40 ${
        isPast ? "opacity-70 hover:opacity-100" : ""
      }`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-semibold text-white truncate pr-2">
          {session.name}
        </h3>
        <div className="flex items-center gap-1.5 shrink-0">
          {isPast && onHide && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onHide();
              }}
              className="p-1 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
              title="Leave draft"
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
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          )}
          <span
            className={`text-xs px-2 py-0.5 rounded-full border ${statusColors[session.status]}`}
          >
            {statusLabels[session.status]}
          </span>
        </div>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between text-gray-400">
          <span>Teams</span>
          <span className="text-gray-300">
            {session.team1_name} vs {session.team2_name}
          </span>
        </div>

        <div className="flex items-center justify-between text-gray-400">
          <span>Mode</span>
          <span className={modeColors[session.draft_mode]}>
            {session.draft_mode.charAt(0).toUpperCase() +
              session.draft_mode.slice(1)}
          </span>
        </div>

        <div className="flex items-center justify-between text-gray-400">
          <span>Games</span>
          <span className="text-gray-300">
            {session.current_game_number} / {session.planned_games}
          </span>
        </div>

        <div className="flex items-center justify-between text-gray-400">
          <span>{isPast ? "Ended" : "Created"}</span>
          <span className="text-gray-500 text-xs">
            {formatDate(
              isPast && session.completed_at
                ? session.completed_at
                : session.created_at,
            )}
          </span>
        </div>
      </div>
    </Card>
  );
}
