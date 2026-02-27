import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Card, Button } from '../components/ui';

type CallbackStatus = 'loading' | 'success' | 'error';

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<CallbackStatus>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      if (!supabase) {
        setStatus('error');
        setErrorMessage('Authentication not configured');
        return;
      }

      try {
        // Get the hash from the URL - Supabase returns tokens in the hash fragment
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const type = hashParams.get('type');

        // Also check for error in hash
        const errorDescription = hashParams.get('error_description');
        if (errorDescription) {
          setStatus('error');
          setErrorMessage(decodeURIComponent(errorDescription));
          return;
        }

        // If we have tokens, set the session
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            setStatus('error');
            setErrorMessage(error.message);
            return;
          }

          setStatus('success');

          // Redirect after a short delay to show success message
          setTimeout(() => {
            navigate('/', { replace: true });
          }, 2000);
          return;
        }

        // If no tokens but this is a signup/recovery callback, try to get session
        if (type === 'signup' || type === 'recovery' || type === 'magiclink') {
          // The session might already be set by Supabase's automatic handling
          const { data: { session }, error } = await supabase.auth.getSession();

          if (error) {
            setStatus('error');
            setErrorMessage(error.message);
            return;
          }

          if (session) {
            setStatus('success');
            setTimeout(() => {
              navigate('/', { replace: true });
            }, 2000);
            return;
          }
        }

        // No valid tokens found
        setStatus('error');
        setErrorMessage('Invalid or expired confirmation link');
      } catch (err) {
        setStatus('error');
        setErrorMessage(err instanceof Error ? err.message : 'An unexpected error occurred');
      }
    };

    handleCallback();
  }, [navigate]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-lol-gray flex items-center justify-center">
        <div className="text-center">
          <svg className="animate-spin h-10 w-10 text-lol-gold mx-auto mb-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-gray-400">Confirming your account...</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-lol-gray flex items-center justify-center p-4">
        <Card variant="bordered" padding="lg" className="max-w-md w-full text-center">
          <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h2 className="text-xl font-bold text-white mb-2">Confirmation Failed</h2>
          <p className="text-gray-400 mb-6">
            {errorMessage || 'Unable to confirm your account. The link may have expired.'}
          </p>
          <Button variant="primary" onClick={() => navigate('/')}>
            Back to Home
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-lol-gray flex items-center justify-center p-4">
      <Card variant="bordered" padding="lg" className="max-w-md w-full text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/10 flex items-center justify-center">
          <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Account Confirmed!</h2>
        <p className="text-gray-400 mb-6">
          Your email has been verified. You're now being signed in...
        </p>
        <div className="flex items-center justify-center gap-2 text-gray-500">
          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-sm">Redirecting...</span>
        </div>
      </Card>
    </div>
  );
}
