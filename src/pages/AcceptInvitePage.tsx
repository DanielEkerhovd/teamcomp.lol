import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { teamMembershipService } from "../lib/teamMembershipService";
import { InviteDetails } from "../types/database";
import { Card, Button } from "../components/ui";
import Modal from "../components/ui/Modal";
import { useAuthStore } from "../stores/useAuthStore";

interface FreeTierConflict {
  existingTeamId: string;
  existingTeamName: string;
  inviteTeamId: string;
  inviteTeamName: string;
  inviteRole: string;
}

export default function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuthStore();

  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [freeTierConflict, setFreeTierConflict] =
    useState<FreeTierConflict | null>(null);
  const [leavingTeam, setLeavingTeam] = useState(false);

  useEffect(() => {
    if (token) {
      loadInviteDetails(token);
    }
  }, [token]);

  const loadInviteDetails = async (inviteToken: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await teamMembershipService.getInviteDetails(inviteToken);
      if (!result) {
        setError("This invite link is invalid or has expired.");
      } else if (result.isAccepted) {
        setError("This invite has already been accepted.");
      } else if (result.isExpired) {
        setError("This invite has expired.");
      } else {
        setInvite(result);
      }
    } catch (err) {
      setError("Couldn't load invite details. Please try again later.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!token) return;

    setAccepting(true);
    setError(null);
    try {
      const result = await teamMembershipService.acceptInvite(token);

      if (result.conflict === "free_tier_team_limit") {
        // Show conflict modal
        setFreeTierConflict({
          existingTeamId: result.existingTeamId!,
          existingTeamName: result.existingTeamName!,
          inviteTeamId: result.inviteTeamId!,
          inviteTeamName: result.inviteTeamName!,
          inviteRole: result.inviteRole!,
        });
        setAccepting(false);
        return;
      }

      if (!result.success) {
        setError(result.error || "Couldn't accept invite. Please try again.");
        setAccepting(false);
        return;
      }

      setSuccess(true);
      // Redirect to team page after a short delay
      setTimeout(() => {
        navigate("/my-teams");
      }, 2000);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Couldn't accept invite. Please try again.");
      }
      console.error(err);
    } finally {
      setAccepting(false);
    }
  };

  const handleLeaveAndJoin = async () => {
    if (!token || !freeTierConflict) return;

    setLeavingTeam(true);
    setError(null);
    try {
      // First leave the existing team
      const leaveResult = await teamMembershipService.leaveTeam(
        freeTierConflict.existingTeamId,
      );
      if (!leaveResult.success) {
        setError(
          leaveResult.error ||
            "Couldn't leave existing team. Please try again.",
        );
        setLeavingTeam(false);
        return;
      }

      // Now try to accept the invite again
      const acceptResult = await teamMembershipService.acceptInvite(token);
      if (!acceptResult.success) {
        setError(
          acceptResult.error ||
            "Couldn't accept invite after leaving team. Please try again.",
        );
        setLeavingTeam(false);
        return;
      }

      setFreeTierConflict(null);
      setSuccess(true);
      setTimeout(() => {
        navigate("/my-teams");
      }, 2000);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Couldn't complete the operation. Please try again.");
      }
      console.error(err);
    } finally {
      setLeavingTeam(false);
    }
  };

  // Loading state
  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-lol-gray flex items-center justify-center">
        <div className="text-center">
          <svg
            className="animate-spin h-10 w-10 text-lol-gold mx-auto mb-4"
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
          <p className="text-gray-400">Loading invite...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !invite) {
    return (
      <div className="min-h-screen bg-lol-gray flex items-center justify-center p-4">
        <Card
          variant="bordered"
          padding="lg"
          className="max-w-md w-full text-center"
        >
          <svg
            className="w-16 h-16 text-red-500 mx-auto mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <h1 className="text-xl font-bold text-white mb-2">Invalid Invite</h1>
          <p className="text-gray-400 mb-6">{error}</p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-4 py-2 bg-lol-gold/10 hover:bg-lol-gold/20 text-lol-gold rounded-lg transition-colors"
          >
            Go to teamcomp.lol
          </Link>
        </Card>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen bg-lol-gray flex items-center justify-center p-4">
        <Card
          variant="bordered"
          padding="lg"
          className="max-w-md w-full text-center"
        >
          <svg
            className="w-16 h-16 text-green-500 mx-auto mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h1 className="text-xl font-bold text-white mb-2">
            Welcome to the team!
          </h1>
          <p className="text-gray-400 mb-6">
            You've joined{" "}
            <span className="text-white font-medium">{invite?.teamName}</span>.
            Redirecting to your teams...
          </p>
        </Card>
      </div>
    );
  }

  // Not logged in - show login prompt
  if (!user) {
    return (
      <div className="min-h-screen bg-lol-gray flex items-center justify-center p-4">
        <Card variant="bordered" padding="lg" className="max-w-md w-full">
          {/* Header */}
          <div className="text-center mb-6">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-lol-gold font-bold mb-4"
            >
              <div>
                <img
                  src="/images/logo.png"
                  alt="teamcomp logo"
                  className="size-10"
                />
              </div>
              <p>
                teamcomp.
                <span className="text-lol-gold">lol</span>
              </p>
            </Link>
            <h1 className="text-2xl font-bold text-white">Team Invite</h1>
          </div>

          {/* Invite details */}
          <div className="bg-lol-surface rounded-xl p-4 mb-6">
            <p className="text-gray-400 text-sm mb-2">
              You've been invited to join
            </p>
            <p className="text-xl font-bold text-white">{invite?.teamName}</p>
            <div className="flex items-center gap-2 mt-2">
              <span
                className={`px-2 py-0.5 rounded text-xs font-medium ${
                  invite?.role === "player"
                    ? "bg-blue-500/20 text-blue-400"
                    : "bg-gray-500/20 text-gray-400"
                }`}
              >
                {invite?.role}
              </span>
              {invite?.playerSlot && (
                <span className="text-gray-500 text-sm">
                  as {invite.playerSlot.role.toUpperCase()} (
                  {invite.playerSlot.summonerName})
                </span>
              )}
            </div>
          </div>

          {/* Login prompt */}
          <div className="text-center">
            <p className="text-gray-400 mb-4">Sign in to accept this invite</p>
            <Link
              to="/"
              className="inline-flex items-center justify-center gap-2 w-full px-4 py-3 bg-lol-gold hover:bg-lol-gold-light text-lol-dark font-semibold rounded-xl transition-colors"
            >
              Sign In
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  // Logged in - show accept UI
  return (
    <div className="min-h-screen bg-lol-gray flex items-center justify-center p-4">
      <Card variant="bordered" padding="lg" className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-lol-gold font-bold mb-4"
          >
            <div>
              <img
                src="/images/logo.png"
                alt="teamcomp logo"
                className="size-10"
              />
            </div>
            <p>
              teamcomp.
              <span className="text-lol-gold">lol</span>
            </p>
          </Link>
          <h1 className="text-2xl font-bold text-white">Team Invite</h1>
        </div>

        {/* Invite details */}
        <div className="bg-lol-surface rounded-xl p-4 mb-6">
          <p className="text-gray-400 text-sm mb-2">
            You've been invited to join
          </p>
          <p className="text-xl font-bold text-white">{invite?.teamName}</p>
          <div className="flex items-center gap-2 mt-2">
            <span
              className={`px-2 py-0.5 rounded text-xs font-medium ${
                invite?.role === "player"
                  ? "bg-blue-500/20 text-blue-400"
                  : "bg-gray-500/20 text-gray-400"
              }`}
            >
              {invite?.role}
            </span>
            {invite?.playerSlot && (
              <span className="text-gray-500 text-sm">
                as {invite.playerSlot.role.toUpperCase()} (
                {invite.playerSlot.summonerName})
              </span>
            )}
          </div>
        </div>

        {/* What you'll be able to do */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-400 mb-2">
            As a {invite?.role}, you'll be able to:
          </h3>
          <ul className="space-y-2 text-sm">
            {invite?.role === "player" ? (
              <>
                <li className="flex items-center gap-2 text-gray-300">
                  <svg
                    className="w-4 h-4 text-green-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  View all team drafts and strategies
                </li>
                <li className="flex items-center gap-2 text-gray-300">
                  <svg
                    className="w-4 h-4 text-green-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Edit your own champion pool
                </li>
                <li className="flex items-center gap-2 text-gray-500">
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
                  Cannot edit other players' pools or team settings
                </li>
              </>
            ) : (
              <>
                <li className="flex items-center gap-2 text-gray-300">
                  <svg
                    className="w-4 h-4 text-green-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  View all team drafts and strategies
                </li>
                <li className="flex items-center gap-2 text-gray-500">
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
                  Cannot make any edits (view only)
                </li>
              </>
            )}
          </ul>
        </div>

        {/* Error message */}
        {error && (
          <div className="p-3 mb-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            variant="ghost"
            className="flex-1"
            onClick={() => navigate("/")}
          >
            Decline
          </Button>
          <Button
            className="flex-1"
            onClick={handleAccept}
            disabled={accepting}
          >
            {accepting ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4"
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
                Joining...
              </>
            ) : (
              "Accept Invite"
            )}
          </Button>
        </div>
      </Card>

      {/* Free Tier Conflict Modal */}
      <Modal
        isOpen={!!freeTierConflict}
        onClose={() => setFreeTierConflict(null)}
        title="Team Limit Reached"
        size="md"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <svg
              className="w-6 h-6 text-yellow-500 flex-shrink-0 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div>
              <p className="text-yellow-200 font-medium">Free tier limit</p>
              <p className="text-yellow-200/80 text-sm mt-1">
                Free accounts can only be a member of one team at a time. You're
                currently a member of{" "}
                <span className="font-medium text-white">
                  {freeTierConflict?.existingTeamName}
                </span>
                .
              </p>
            </div>
          </div>

          <p className="text-gray-400">
            To join{" "}
            <span className="text-white font-medium">
              {freeTierConflict?.inviteTeamName}
            </span>{" "}
            as{" "}
            <span className="text-white">{freeTierConflict?.inviteRole}</span>,
            you can:
          </p>

          <div className="space-y-3">
            {/* Option 1: Leave and Join */}
            <button
              onClick={handleLeaveAndJoin}
              disabled={leavingTeam}
              className="w-full flex items-center gap-3 p-4 bg-lol-surface hover:bg-lol-border rounded-lg border border-lol-border transition-colors text-left disabled:opacity-50"
            >
              <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center flex-shrink-0">
                <svg
                  className="w-5 h-5 text-red-400"
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
              </div>
              <div className="flex-1">
                <p className="text-white font-medium">
                  {leavingTeam
                    ? "Switching teams..."
                    : `Leave ${freeTierConflict?.existingTeamName}`}
                </p>
                <p className="text-sm text-gray-500">
                  Leave your current team and join{" "}
                  {freeTierConflict?.inviteTeamName}
                </p>
              </div>
              {leavingTeam && (
                <svg
                  className="animate-spin h-5 w-5 text-gray-400"
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
              )}
            </button>

            {/* Option 2: Upgrade */}
            <button
              onClick={() => {
                setFreeTierConflict(null);
                navigate("/upgrade");
              }}
              className="w-full flex items-center gap-3 p-4 bg-lol-gold/10 hover:bg-lol-gold/20 rounded-lg border border-lol-gold/30 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-lol-gold/20 flex items-center justify-center flex-shrink-0">
                <svg
                  className="w-5 h-5 text-lol-gold"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-lol-gold font-medium">
                  Upgrade to Supporter
                </p>
                <p className="text-sm text-gray-500">
                  Join unlimited teams and unlock all features
                </p>
              </div>
            </button>
          </div>

          {/* Error in modal */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Cancel */}
          <button
            onClick={() => setFreeTierConflict(null)}
            className="w-full py-2 text-gray-500 hover:text-gray-400 text-sm transition-colors"
          >
            Cancel
          </button>
        </div>
      </Modal>
    </div>
  );
}
