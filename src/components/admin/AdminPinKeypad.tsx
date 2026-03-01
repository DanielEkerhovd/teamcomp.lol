import { useState, useEffect, useCallback, useRef } from 'react';

interface AdminPinKeypadProps {
  onSubmit: (pin: string) => Promise<{ error: string | null }>;
  title: string;
  subtitle?: string;
  isLoading?: boolean;
  error?: string | null;
  lockedUntil?: Date | null;
}

export default function AdminPinKeypad({
  onSubmit,
  title,
  subtitle,
  isLoading = false,
  error,
  lockedUntil,
}: AdminPinKeypadProps) {
  const [digits, setDigits] = useState<string[]>([]);
  const [shake, setShake] = useState(false);
  const [lockCountdown, setLockCountdown] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Lockout countdown
  useEffect(() => {
    if (!lockedUntil) {
      setLockCountdown(null);
      return;
    }
    const update = () => {
      const remaining = Math.max(0, Math.ceil((lockedUntil.getTime() - Date.now()) / 1000));
      setLockCountdown(remaining > 0 ? remaining : null);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [lockedUntil]);

  // Focus container for keyboard input
  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  const triggerShake = useCallback(() => {
    setShake(true);
    setTimeout(() => {
      setShake(false);
      setDigits([]);
    }, 500);
  }, []);

  // Show shake on error
  useEffect(() => {
    if (error) {
      triggerShake();
    }
  }, [error, triggerShake]);

  const addDigit = useCallback(
    (digit: string) => {
      if (isLoading || lockCountdown) return;
      setDigits((prev) => {
        if (prev.length >= 6) return prev;
        const next = [...prev, digit];
        if (next.length === 6) {
          // Auto-submit
          setTimeout(async () => {
            const result = await onSubmit(next.join(''));
            if (result.error) {
              // shake is triggered by error prop change
            }
          }, 100);
        }
        return next;
      });
    },
    [isLoading, lockCountdown, onSubmit]
  );

  const removeDigit = useCallback(() => {
    if (isLoading || lockCountdown) return;
    setDigits((prev) => prev.slice(0, -1));
  }, [isLoading, lockCountdown]);

  // Keyboard input
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        addDigit(e.key);
      } else if (e.key === 'Backspace') {
        removeDigit();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [addDigit, removeDigit]);

  const formatCountdown = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const keys = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['', '0', 'back'],
  ];

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      className="flex flex-col items-center justify-center min-h-[80vh] outline-none select-none"
    >
      {/* Lock icon */}
      <div className="w-16 h-16 rounded-2xl bg-lol-gold/10 flex items-center justify-center mb-6">
        <svg className="w-8 h-8 text-lol-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
        </svg>
      </div>

      {/* Title */}
      <h2 className="text-xl font-bold text-white mb-1">{title}</h2>
      {subtitle && <p className="text-sm text-gray-400 mb-6">{subtitle}</p>}
      {!subtitle && <div className="mb-6" />}

      {/* PIN dots */}
      <div className={`flex gap-3 mb-8 ${shake ? 'animate-shake' : ''}`}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full transition-all duration-150 ${
              i < digits.length
                ? 'bg-lol-gold scale-110'
                : 'bg-lol-surface border border-lol-border'
            }`}
          />
        ))}
      </div>

      {/* Error / lockout message */}
      {lockCountdown ? (
        <div className="text-red-400 text-sm mb-4 text-center">
          Locked. Try again in {formatCountdown(lockCountdown)}
        </div>
      ) : error ? (
        <div className="text-red-400 text-sm mb-4 text-center max-w-xs">
          {error}
        </div>
      ) : (
        <div className="h-9 mb-4" />
      )}

      {/* Loading indicator */}
      {isLoading && (
        <div className="mb-4">
          <div className="w-5 h-5 border-2 border-lol-gold/30 border-t-lol-gold rounded-full animate-spin" />
        </div>
      )}

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-3">
        {keys.map((row, ri) =>
          row.map((key, ci) => {
            if (key === '') {
              return <div key={`${ri}-${ci}`} className="w-18 h-14" />;
            }
            if (key === 'back') {
              return (
                <button
                  key={`${ri}-${ci}`}
                  onClick={removeDigit}
                  disabled={isLoading || !!lockCountdown}
                  className="w-18 h-14 rounded-xl flex items-center justify-center text-gray-400 hover:bg-lol-surface/50 active:bg-lol-surface transition-colors disabled:opacity-30"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9.75 14.25 12m0 0 2.25 2.25M14.25 12l2.25-2.25M14.25 12 12 14.25m-2.58 4.92-6.374-6.375a1.125 1.125 0 0 1 0-1.59L9.42 4.83c.21-.211.497-.33.795-.33H19.5a2.25 2.25 0 0 1 2.25 2.25v10.5a2.25 2.25 0 0 1-2.25 2.25h-9.284c-.298 0-.585-.119-.795-.33Z" />
                  </svg>
                </button>
              );
            }
            return (
              <button
                key={`${ri}-${ci}`}
                onClick={() => addDigit(key)}
                disabled={isLoading || !!lockCountdown}
                className="w-18 h-14 rounded-xl bg-lol-surface/50 border border-lol-border text-white text-xl font-medium hover:bg-lol-card-hover active:bg-lol-gold/20 active:border-lol-gold/40 transition-all disabled:opacity-30"
              >
                {key}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
