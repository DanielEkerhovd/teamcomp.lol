import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDraftStore } from "../stores/useDraftStore";
import { useAuthStore } from "../stores/useAuthStore";
import { Card, Button } from "../components/ui";
import { liveDraftService } from "../lib/liveDraftService";
import type { LiveDraftSession } from "../types/liveDraft";

export default function HomePage() {
  const { sessions } = useDraftStore();
  const { user } = useAuthStore();
  const [liveSessions, setLiveSessions] = useState<LiveDraftSession[]>([]);
  const [isLoadingLive, setIsLoadingLive] = useState(false);

  // Fetch live draft sessions
  const loadLiveSessions = useCallback(async () => {
    if (!user) {
      setLiveSessions([]);
      return;
    }
    setIsLoadingLive(true);
    try {
      const userSessions = await liveDraftService.getUserSessions();
      setLiveSessions(userSessions);
    } catch (err) {
      console.error("Failed to load live sessions:", err);
    } finally {
      setIsLoadingLive(false);
    }
  }, [user]);

  useEffect(() => {
    loadLiveSessions();
  }, [loadLiveSessions]);

  const handleHideSession = async (sessionId: string) => {
    try {
      await liveDraftService.hideSession(sessionId);
      // Refresh the list
      await loadLiveSessions();
    } catch (err) {
      console.error("Failed to hide session:", err);
    }
  };

  const recentSessions = sessions
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 3);

  const activeLiveSessions = liveSessions.filter(
    (s) =>
      s.status === "lobby" ||
      s.status === "in_progress" ||
      s.status === "paused",
  );
  const pastLiveSessions = liveSessions
    .filter((s) => s.status === "completed" || s.status === "cancelled")
    .slice(0, 5);

  return (
    <div className="space-y-10 py-4">
      {/* Hero Section */}
      <div className="text-center py-8 flex flex-col gap-6">
        <div className="flex flex-row-reverse justify-center gap-5">
          <h1 className="text-5xl font-bold text-white mb-4">
            teamcomp.<span className="text-lol-gold">lol</span>
          </h1>
          <div>
            <img
              src="/images/logo.png"
              alt="teamcomp.lol logo"
              className="size-14"
            />
          </div>
        </div>
        <p className="text-xl text-gray-400 max-w-2xl mx-auto">
          An all-in-one platform for League of Legends draft planning and team
          management.
        </p>
      </div>

      {/* Tools */}
      <div>
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-white">Tools</h2>
          <p className="text-sm text-gray-400 mt-1">
            Utilities for draft planning and collaboration
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            to="/live-draft"
            className="group p-6 rounded-xl border-2 border-lol-border bg-lol-dark hover:border-lol-gold hover:bg-lol-card-hover transition-all duration-200"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-lol-gold/10 text-lol-gold group-hover:bg-lol-gold/20 transition-colors">
                <svg
                  className="w-6 h-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white group-hover:text-lol-gold transition-colors">
                  Live Draft
                </h3>
                <p className="text-sm text-gray-400 mt-1">
                  Live drafting tool for scrims and matches. Integrated with your team and drafts data for more informed drafting
                </p>
              </div>
            </div>
          </Link>

          <Link
            to="/tools"
            className="group p-6 rounded-xl border-2 border-lol-border bg-lol-dark hover:border-lol-gold hover:bg-lol-card-hover transition-all duration-200"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-lol-gold/10 text-lol-gold group-hover:bg-lol-gold/20 transition-colors">
                <svg
                  className="w-6 h-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white group-hover:text-lol-gold transition-colors">
                  Draft Theorycrafting
                </h3>
                <p className="text-sm text-gray-400 mt-1">
                  Simulate and plan drafts with your team's champion pools
                </p>
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* Getting Started & Sessions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card variant="elevated" padding="lg">
          <h2 className="text-xl font-semibold text-white mb-6">
            Getting Started
          </h2>
          <div className="space-y-3">
            <Link
              to="/my-teams"
              className="flex items-center gap-4 p-3 rounded-lg hover:bg-lol-dark transition-colors group"
            >
              <div className="shrink-0 w-8 h-8 rounded-full bg-lol-gold/20 text-lol-gold flex items-center justify-center font-bold">
                1
              </div>
              <div>
                <h3 className="font-semibold text-white group-hover:text-lol-gold transition-colors">
                  Create your team
                </h3>
                <p className="text-sm text-gray-400 mt-0.5">
                  Add your players and their roles
                </p>
              </div>
            </Link>
            <Link
              to="/enemy-teams"
              className="flex items-center gap-4 p-3 rounded-lg hover:bg-lol-dark transition-colors group"
            >
              <div className="shrink-0 w-8 h-8 rounded-full bg-lol-gold/20 text-lol-gold flex items-center justify-center font-bold">
                2
              </div>
              <div>
                <h3 className="font-semibold text-white group-hover:text-lol-gold transition-colors">
                  Add enemy teams
                </h3>
                <p className="text-sm text-gray-400 mt-0.5">
                  Track opponents you'll face in scrims or matches
                </p>
              </div>
            </Link>
            <Link
              to="/champion-pool"
              className="flex items-center gap-4 p-3 rounded-lg hover:bg-lol-dark transition-colors group"
            >
              <div className="shrink-0 w-8 h-8 rounded-full bg-lol-gold/20 text-lol-gold flex items-center justify-center font-bold">
                3
              </div>
              <div>
                <h3 className="font-semibold text-white group-hover:text-lol-gold transition-colors">
                  Edit champion pools
                </h3>
                <p className="text-sm text-gray-400 mt-0.5">
                  Customize your teams champion pools, scout your enemies pools
                </p>
              </div>
            </Link>
            <Link
              to="/draft"
              className="flex items-center gap-4 p-3 rounded-lg hover:bg-lol-dark transition-colors group"
            >
              <div className="shrink-0 w-8 h-8 rounded-full bg-lol-gold/20 text-lol-gold flex items-center justify-center font-bold">
                4
              </div>
              <div>
                <h3 className="font-semibold text-white group-hover:text-lol-gold transition-colors">
                  Start drafting
                </h3>
                <p className="text-sm text-gray-400 mt-0.5">
                  Plan picks, bans, and priorities, using player data and pools
                </p>
              </div>
            </Link>
          </div>
        </Card>

        <Card variant="elevated" padding="lg">
          <h2 className="text-xl font-semibold text-white mb-6">
            Your Sessions
          </h2>

          {/* Active Live Drafts */}
          {activeLiveSessions.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                Active Live Drafts
              </h3>
              <div className="space-y-2">
                {activeLiveSessions.map((session) => (
                  <LiveSessionCard
                    key={session.id}
                    session={session}
                    onHide={handleHideSession}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Past Live Drafts */}
          {pastLiveSessions.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-400 mb-3">
                Recent Live Drafts
              </h3>
              <div className="space-y-2">
                {pastLiveSessions.map((session) => (
                  <LiveSessionCard
                    key={session.id}
                    session={session}
                    isPast
                    onHide={handleHideSession}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Local Draft Sessions */}
          {recentSessions.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-3">
                Local Drafts
              </h3>
              <div className="space-y-2">
                {recentSessions.map((session) => (
                  <Link
                    key={session.id}
                    to={`/draft/${session.id}`}
                    className="block p-3 bg-lol-dark rounded-lg border border-lol-border hover:bg-lol-card-hover hover:border-lol-border-light transition-all duration-200"
                  >
                    <div className="text-white font-medium text-sm">
                      {session.name}
                    </div>
                    <div className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                      <span>
                        {new Date(session.updatedAt).toLocaleDateString(
                          "en-GB",
                        )}
                      </span>
                      <span className="text-gray-600">·</span>
                      <span className="text-yellow-500">
                        {(session.priorityGroups || []).reduce(
                          (sum, g) => sum + g.championIds.length,
                          0,
                        )}{" "}
                        priorities
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {activeLiveSessions.length === 0 &&
            pastLiveSessions.length === 0 &&
            recentSessions.length === 0 &&
            !isLoadingLive && (
              <div className="text-center py-8">
                <div className="text-gray-500 mb-3">
                  <svg
                    className="w-10 h-10 mx-auto"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <p className="text-gray-500">No sessions yet</p>
                <Link to="/live-draft" className="inline-block mt-4">
                  <Button variant="outline" size="sm">
                    Start a Live Draft
                  </Button>
                </Link>
              </div>
            )}

          {/* Loading State */}
          {isLoadingLive && user && (
            <div className="text-center py-4">
              <div className="animate-spin w-5 h-5 border-2 border-lol-gold border-t-transparent rounded-full mx-auto" />
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function LiveSessionCard({
  session,
  isPast = false,
  onHide,
}: {
  session: LiveDraftSession;
  isPast?: boolean;
  onHide?: (sessionId: string) => void;
}) {
  const navigate = useNavigate();
  const [isHiding, setIsHiding] = useState(false);

  const statusColors: Record<string, string> = {
    lobby: "bg-yellow-500/20 text-yellow-400",
    in_progress: "bg-green-500/20 text-green-400",
    paused: "bg-orange-500/20 text-orange-400",
    completed: "bg-gray-500/20 text-gray-400",
    cancelled: "bg-red-500/20 text-red-400",
  };

  const statusLabels: Record<string, string> = {
    lobby: "Lobby",
    in_progress: "Live",
    paused: "Paused",
    completed: "Completed",
    cancelled: "Cancelled",
  };

  const handleClick = () => {
    navigate(`/live-draft/lobby/${session.id}`);
  };

  const handleHide = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onHide || isHiding) return;
    setIsHiding(true);
    try {
      await onHide(session.id);
    } finally {
      setIsHiding(false);
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`group relative p-3 bg-lol-dark rounded-lg border border-lol-border hover:bg-lol-card-hover hover:border-lol-border-light transition-all duration-200 cursor-pointer ${
        isPast ? "opacity-70 hover:opacity-100" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="text-white font-medium text-sm truncate pr-2">
          {session.name}
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${statusColors[session.status]}`}
          >
            {statusLabels[session.status]}
          </span>
          {onHide && (
            <button
              onClick={handleHide}
              disabled={isHiding}
              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-all"
              title="Remove from your sessions"
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>
      </div>
      <div className="text-xs text-gray-500 mt-1 flex items-center gap-2">
        <span>
          {session.team1_name} vs {session.team2_name}
        </span>
        <span className="text-gray-600">·</span>
        <span>
          Game {session.current_game_number}/{session.planned_games}
        </span>
      </div>
    </div>
  );
}
