import { useState } from 'react';
import { useAuthStore } from '../../stores/useAuthStore';
import { useAuthContext } from '../../contexts/AuthContext';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Button from '../ui/Button';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type AuthMode = 'signin' | 'signup' | 'forgot';

export default function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Password validation
  const hasMinLength = password.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  const isPasswordValid = hasMinLength && hasLetter && hasDigit;

  const { signInWithEmail, signUpWithEmail, signInWithGoogle, signInWithDiscord, signInWithTwitch, resetPassword, signOut, isLoading, error, clearError } = useAuthStore();
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [confirmationEmailSent, setConfirmationEmailSent] = useState(false);
  const { isConfigured } = useAuthContext();

  // Handle switching to a different account (clear any existing session)
  const handleUseDifferentAccount = async () => {
    // Sign out any existing session
    await signOut();
    // Reset modal state
    resetForm();
    setMode('signin');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === 'forgot') {
      const result = await resetPassword(email);
      if (!result.error) {
        setResetEmailSent(true);
      }
      return;
    }

    if (mode === 'signup' && (!isPasswordValid || password !== confirmPassword)) {
      return;
    }

    if (mode === 'signin') {
      const result = await signInWithEmail(email, password);
      if (!result.error) {
        onClose();
        resetForm();
      }
    } else {
      const result = await signUpWithEmail(email, password);
      if (result.confirmationRequired) {
        setConfirmationEmailSent(true);
      } else if (!result.error) {
        onClose();
        resetForm();
      }
    }
  };

  const handleGoogleSignIn = async () => {
    await signInWithGoogle();
  };

  const handleDiscordSignIn = async () => {
    await signInWithDiscord();
  };

  const handleTwitchSignIn = async () => {
    await signInWithTwitch();
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setResetEmailSent(false);
    setConfirmationEmailSent(false);
    clearError();
  };

  const switchMode = (newMode?: AuthMode) => {
    setMode(newMode ?? (mode === 'signin' ? 'signup' : 'signin'));
    setResetEmailSent(false);
    clearError();
  };

  if (!isConfigured) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Sign In">
        <div className="text-center py-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-lol-surface flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-white mb-2">Cloud Features Not Configured</h3>
          <p className="text-gray-400 text-sm mb-4">
            To enable sign-in and cloud sync, configure your Supabase credentials in the .env file.
          </p>
          <code className="block bg-lol-surface p-3 rounded-lg text-xs text-gray-300 text-left">
            VITE_SUPABASE_URL=your-url<br />
            VITE_SUPABASE_ANON_KEY=your-key
          </code>
        </div>
      </Modal>
    );
  }

  const getTitle = () => {
    if (mode === 'forgot') return 'Reset Password';
    return mode === 'signin' ? 'Sign In' : 'Create Account';
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={getTitle()}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email confirmation sent - success message */}
        {confirmationEmailSent ? (
          <div className="text-center py-4">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/10 flex items-center justify-center">
              <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-white mb-2">Check your email</h3>
            <p className="text-gray-400 text-sm mb-4">
              We've sent a confirmation link to <span className="text-white">{email}</span>
            </p>
            <p className="text-gray-500 text-xs mb-4">
              Click the link in the email to activate your account. You'll be automatically signed in.
              <br />
              <span className="text-yellow-500">The link expires in 1 hour.</span>
            </p>
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setConfirmationEmailSent(false);
                  switchMode('signin');
                }}
              >
                Back to Sign In
              </Button>
              <button
                type="button"
                onClick={handleUseDifferentAccount}
                className="text-sm text-gray-400 hover:text-lol-gold transition-colors"
              >
                Use a different account
              </button>
            </div>
          </div>
        ) : mode === 'forgot' && resetEmailSent ? (
          <div className="text-center py-4">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/10 flex items-center justify-center">
              <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-white mb-2">Check your email</h3>
            <p className="text-gray-400 text-sm mb-4">
              We've sent a password reset link to <span className="text-white">{email}</span>
            </p>
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => switchMode('signin')}
              >
                Back to Sign In
              </Button>
              <button
                type="button"
                onClick={handleUseDifferentAccount}
                className="text-sm text-gray-400 hover:text-lol-gold transition-colors"
              >
                Use a different account
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* OAuth Buttons - hide in forgot mode */}
            {mode !== 'forgot' && (
              <>
                <div className="space-y-2">
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full flex items-center justify-center gap-3"
                    onClick={handleDiscordSignIn}
                    disabled={isLoading}
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                    </svg>
                    Continue with Discord
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full flex items-center justify-center gap-3"
                    onClick={handleGoogleSignIn}
                    disabled={isLoading}
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="currentColor"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    Continue with Google
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full flex items-center justify-center gap-3"
                    onClick={handleTwitchSignIn}
                    disabled={isLoading}
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z"/>
                    </svg>
                    Continue with Twitch
                  </Button>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-lol-border" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-lol-card text-gray-400">or</span>
                  </div>
                </div>
              </>
            )}

            {/* Forgot password description */}
            {mode === 'forgot' && (
              <p className="text-gray-400 text-sm">
                Enter your email address and we'll send you a link to reset your password.
              </p>
            )}

            {/* Email/Password Form */}
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />

            {mode !== 'forgot' && (
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-300">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full px-4 py-3 text-sm bg-lol-dark border border-lol-border rounded-xl text-white placeholder-gray-500 transition-all duration-200 focus:outline-none focus:border-lol-gold/50 focus:ring-2 focus:ring-lol-gold/20 hover:border-lol-border-light pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors"
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                {mode === 'signup' && (
                  <div className="flex flex-col gap-1 mt-1">
                    <div className={`flex items-center gap-2 text-xs ${hasMinLength ? 'text-green-400' : 'text-gray-500'}`}>
                      {hasMinLength ? (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01" />
                        </svg>
                      )}
                      At least 8 characters
                    </div>
                    <div className={`flex items-center gap-2 text-xs ${hasLetter ? 'text-green-400' : 'text-gray-500'}`}>
                      {hasLetter ? (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01" />
                        </svg>
                      )}
                      Contains a letter
                    </div>
                    <div className={`flex items-center gap-2 text-xs ${hasDigit ? 'text-green-400' : 'text-gray-500'}`}>
                      {hasDigit ? (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01" />
                        </svg>
                      )}
                      Contains a number
                    </div>
                  </div>
                )}
              </div>
            )}

            {mode === 'signup' && (
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-300">Confirm Password</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full px-4 py-3 text-sm bg-lol-dark border border-lol-border rounded-xl text-white placeholder-gray-500 transition-all duration-200 focus:outline-none focus:border-lol-gold/50 focus:ring-2 focus:ring-lol-gold/20 hover:border-lol-border-light pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors"
                  >
                    {showConfirmPassword ? (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Forgot password link - only on signin */}
            {mode === 'signin' && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => switchMode('forgot')}
                  className="text-sm text-gray-400 hover:text-lol-gold transition-colors"
                >
                  Forgot password?
                </button>
              </div>
            )}

            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}

            {mode === 'signup' && password !== confirmPassword && confirmPassword && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                Passwords do not match
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              className="w-full"
              disabled={isLoading || (mode === 'signup' && (!isPasswordValid || password !== confirmPassword))}
            >
              {isLoading ? 'Loading...' : mode === 'signin' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Send Reset Link'}
            </Button>

            <div className="text-center text-sm text-gray-400">
              {mode === 'signin' && (
                <>
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={() => switchMode('signup')}
                    className="text-lol-gold hover:text-lol-gold-light transition-colors"
                  >
                    Sign up
                  </button>
                </>
              )}
              {mode === 'signup' && (
                <>
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => switchMode('signin')}
                    className="text-lol-gold hover:text-lol-gold-light transition-colors"
                  >
                    Sign in
                  </button>
                </>
              )}
              {mode === 'forgot' && (
                <>
                  Remember your password?{' '}
                  <button
                    type="button"
                    onClick={() => switchMode('signin')}
                    className="text-lol-gold hover:text-lol-gold-light transition-colors"
                  >
                    Sign in
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </form>
    </Modal>
  );
}
