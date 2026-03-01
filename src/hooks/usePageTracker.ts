import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/useAuthStore';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const DEBOUNCE_MS = 2000;

function getSessionId(): string {
  let sessionId = sessionStorage.getItem('tc-session-id');
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem('tc-session-id', sessionId);
  }
  return sessionId;
}

export function usePageTracker() {
  const location = useLocation();
  const lastTracked = useRef<{ url: string; time: number }>({ url: '', time: 0 });
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return;

    const now = Date.now();
    const currentUrl = location.pathname;

    // Debounce: ignore if same URL within DEBOUNCE_MS
    if (
      currentUrl === lastTracked.current.url &&
      now - lastTracked.current.time < DEBOUNCE_MS
    ) {
      return;
    }

    lastTracked.current = { url: currentUrl, time: now };

    const payload = {
      page_url: currentUrl,
      referrer: document.referrer || null,
      screen_width: window.innerWidth,
      user_id: user?.id || null,
      session_id: getSessionId(),
    };

    fetch(`${SUPABASE_URL}/functions/v1/track-pageview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(payload),
    }).catch(() => {
      // Silently ignore tracking failures
    });
  }, [location.pathname, user?.id]);
}
