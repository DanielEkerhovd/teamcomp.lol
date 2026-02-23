import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { teamMembershipService } from '../lib/teamMembershipService';
import { InviteDetails } from '../types/database';
import { Card, Button } from '../components/ui';
import { useAuthStore } from '../stores/useAuthStore';

export default function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuthStore();

  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

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
        setError('This invite link is invalid or has expired.');
      } else if (result.isAccepted) {
        setError('This invite has already been accepted.');
      } else if (result.isExpired) {
        setError('This invite has expired.');
      } else {
        setInvite(result);
      }
    } catch (err) {
      setError('Failed to load invite details. Please try again later.');
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
      await teamMembershipService.acceptInvite(token);
      setSuccess(true);
      // Redirect to team page after a short delay
      setTimeout(() => {
        navigate('/my-teams');
      }, 2000);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to accept invite. Please try again.');
      }
      console.error(err);
    } finally {
      setAccepting(false);
    }
  };

  // Loading state
  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-lol-gray flex items-center justify-center">
        <div className="text-center">
          <svg className="animate-spin h-10 w-10 text-lol-gold mx-auto mb-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
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
        <Card variant="bordered" padding="lg" className="max-w-md w-full text-center">
          <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h1 className="text-xl font-bold text-white mb-2">Invalid Invite</h1>
          <p className="text-gray-400 mb-6">{error}</p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-4 py-2 bg-lol-gold/10 hover:bg-lol-gold/20 text-lol-gold rounded-lg transition-colors"
          >
            Go to Teamcomp.lol
          </Link>
        </Card>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen bg-lol-gray flex items-center justify-center p-4">
        <Card variant="bordered" padding="lg" className="max-w-md w-full text-center">
          <svg className="w-16 h-16 text-green-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h1 className="text-xl font-bold text-white mb-2">Welcome to the team!</h1>
          <p className="text-gray-400 mb-6">
            You've joined <span className="text-white font-medium">{invite?.teamName}</span>.
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
            <Link to="/" className="inline-flex items-center gap-2 text-lol-gold font-bold mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-lol-gold-light to-lol-gold flex items-center justify-center text-lol-dark font-bold text-sm">
                TC
              </div>
              <span>Teamcomp.lol</span>
            </Link>
            <h1 className="text-2xl font-bold text-white">Team Invite</h1>
          </div>

          {/* Invite details */}
          <div className="bg-lol-surface rounded-xl p-4 mb-6">
            <p className="text-gray-400 text-sm mb-2">You've been invited to join</p>
            <p className="text-xl font-bold text-white">{invite?.teamName}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                invite?.role === 'player'
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'bg-gray-500/20 text-gray-400'
              }`}>
                {invite?.role}
              </span>
              {invite?.playerSlot && (
                <span className="text-gray-500 text-sm">
                  as {invite.playerSlot.role.toUpperCase()} ({invite.playerSlot.summonerName})
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
          <Link to="/" className="inline-flex items-center gap-2 text-lol-gold font-bold mb-4">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-lol-gold-light to-lol-gold flex items-center justify-center text-lol-dark font-bold text-sm">
              TC
            </div>
            <span>Teamcomp.lol</span>
          </Link>
          <h1 className="text-2xl font-bold text-white">Team Invite</h1>
        </div>

        {/* Invite details */}
        <div className="bg-lol-surface rounded-xl p-4 mb-6">
          <p className="text-gray-400 text-sm mb-2">You've been invited to join</p>
          <p className="text-xl font-bold text-white">{invite?.teamName}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
              invite?.role === 'player'
                ? 'bg-blue-500/20 text-blue-400'
                : 'bg-gray-500/20 text-gray-400'
            }`}>
              {invite?.role}
            </span>
            {invite?.playerSlot && (
              <span className="text-gray-500 text-sm">
                as {invite.playerSlot.role.toUpperCase()} ({invite.playerSlot.summonerName})
              </span>
            )}
          </div>
        </div>

        {/* What you'll be able to do */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-400 mb-2">As a {invite?.role}, you'll be able to:</h3>
          <ul className="space-y-2 text-sm">
            {invite?.role === 'player' ? (
              <>
                <li className="flex items-center gap-2 text-gray-300">
                  <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  View all team drafts and strategies
                </li>
                <li className="flex items-center gap-2 text-gray-300">
                  <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Edit your own champion pool
                </li>
                <li className="flex items-center gap-2 text-gray-500">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Cannot edit other players' pools or team settings
                </li>
              </>
            ) : (
              <>
                <li className="flex items-center gap-2 text-gray-300">
                  <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  View all team drafts and strategies
                </li>
                <li className="flex items-center gap-2 text-gray-500">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
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
            onClick={() => navigate('/')}
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
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Joining...
              </>
            ) : (
              'Accept Invite'
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
}
