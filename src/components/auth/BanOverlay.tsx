import { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/useAuthStore';

export default function BanOverlay() {
  const profile = useAuthStore(s => s.profile);
  const signOut = useAuthStore(s => s.signOut);
  const refreshProfile = useAuthStore(s => s.refreshProfile);
  const [timeLeft, setTimeLeft] = useState('');

  const bannedAt = profile?.bannedAt;
  const banReason = profile?.banReason;
  const isAutoBan = banReason?.startsWith('Automatic');

  const bannedTime = bannedAt ? new Date(bannedAt).getTime() : 0;
  const expiresAt = isAutoBan && bannedTime ? bannedTime + 24 * 60 * 60 * 1000 : null;

  useEffect(() => {
    if (!expiresAt) return;

    const update = () => {
      const remaining = expiresAt - Date.now();
      if (remaining <= 0) {
        refreshProfile();
        return;
      }
      const hours = Math.floor(remaining / 3600000);
      const minutes = Math.floor((remaining % 3600000) / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      setTimeLeft(
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      );
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, refreshProfile]);

  if (!bannedAt) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-lol-dark/95 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Warning icon */}
        <div className="mx-auto w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
          <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-white">Account Suspended</h1>

        <p className="text-gray-400">{banReason}</p>

        {isAutoBan && timeLeft && (
          <div className="bg-lol-surface border border-lol-border rounded-xl px-4 py-4">
            <p className="text-sm text-gray-400">Suspension expires in</p>
            <p className="text-2xl font-mono text-lol-gold mt-2">{timeLeft}</p>
          </div>
        )}

        {!isAutoBan && (
          <p className="text-sm text-gray-500">
            If you believe this is an error, please contact support.
          </p>
        )}

        <button
          onClick={() => signOut()}
          className="px-6 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl transition-colors font-medium"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
