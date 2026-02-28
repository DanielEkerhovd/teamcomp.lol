import { useState } from 'react';
import { useAuthStore } from '../../stores/useAuthStore';

export default function UsernameSetupModal() {
  const { user, profile, updateDisplayName } = useAuthStore();
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Only show for authenticated users whose profile has loaded but has no display name
  // Important: profile being null means it hasn't loaded yet, so don't show the modal
  if (!user || !profile || profile.displayName) return null;

  const handleSubmit = async () => {
    const trimmed = username.trim();

    if (!trimmed) {
      setError('Username cannot be empty');
      return;
    }

    if (trimmed.length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }

    if (trimmed.length > 30) {
      setError('Username must be 30 characters or less');
      return;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
      setError('Username can only contain letters, numbers, underscores, and hyphens');
      return;
    }

    setIsSaving(true);
    setError(null);

    const result = await updateDisplayName(trimmed);

    if (result.error) {
      setError(result.error);
      setIsSaving(false);
    }
    // On success, profile will update and modal will close automatically
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 bg-lol-card border border-lol-border rounded-2xl shadow-2xl shadow-black/50">
        {/* Header */}
        <div className="px-8 pt-8 pb-4 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-lol-gold-light to-lol-gold flex items-center justify-center shadow-lg shadow-lol-gold/20">
            <svg className="w-8 h-8 text-lol-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Choose Your Username</h1>
          <p className="text-gray-400">This is how other players will see you</p>
        </div>

        {/* Form */}
        <div className="px-8 py-6">
          <div className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-2">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isSaving) handleSubmit();
                }}
                disabled={isSaving}
                maxLength={30}
                placeholder="Enter a unique username"
                className={`w-full px-4 py-3 bg-lol-dark border rounded-xl text-white placeholder-gray-500 focus:outline-none transition-colors ${
                  error
                    ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/20'
                    : 'border-lol-border focus:border-lol-gold/50 focus:ring-2 focus:ring-lol-gold/20'
                } disabled:opacity-60`}
                autoFocus
              />
              {error && (
                <div className="flex items-center gap-2 mt-2 text-red-400 text-sm">
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}
            </div>

            <ul className="text-xs text-gray-500 space-y-1 pl-4">
              <li className="list-disc">3-30 characters</li>
              <li className="list-disc">Letters, numbers, underscores, and hyphens only</li>
              <li className="list-disc">Must be unique</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 pb-8 pt-2">
          <button
            onClick={handleSubmit}
            disabled={isSaving || !username.trim()}
            className="flex items-center justify-center gap-2 w-full py-3 px-6 bg-gradient-to-r from-lol-gold-light to-lol-gold text-lol-dark font-semibold rounded-xl hover:shadow-lg hover:shadow-lol-gold/20 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSaving && (
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            )}
            {isSaving ? 'Saving...' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
