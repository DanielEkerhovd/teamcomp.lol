import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { liveDraftService } from '../lib/liveDraftService';

export default function JoinLiveDraftPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function resolveToken() {
      if (!token) {
        setError('Invalid invite link');
        return;
      }

      try {
        const session = await liveDraftService.getSessionByToken(token);
        if (session) {
          // Redirect to the lobby with the session ID
          navigate(`/live-draft/${session.id}`, { replace: true });
        } else {
          setError('Session not found or link has expired');
        }
      } catch (err) {
        console.error('Failed to resolve invite token:', err);
        setError('Failed to join session');
      }
    }

    resolveToken();
  }, [token, navigate]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="text-red-400 text-lg">{error}</div>
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 bg-lol-surface border border-lol-border rounded-lg text-white hover:bg-lol-card-hover transition-colors"
        >
          Go Home
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex items-center gap-3 text-gray-400">
        <svg className="animate-spin h-6 w-6" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        Joining session...
      </div>
    </div>
  );
}
