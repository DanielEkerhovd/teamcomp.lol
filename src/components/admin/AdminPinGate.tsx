import { useEffect, type ReactNode } from 'react';
import { useAdminSessionStore } from '../../stores/useAdminSessionStore';
import AdminPinKeypad from './AdminPinKeypad';
import AdminPinSetup from './AdminPinSetup';

interface AdminPinGateProps {
  children: ReactNode;
}

export default function AdminPinGate({ children }: AdminPinGateProps) {
  const {
    hasPin,
    isVerified,
    isLoading,
    error,
    lockedUntil,
    checkHasPin,
    verifyPin,
  } = useAdminSessionStore();

  useEffect(() => {
    checkHasPin();
  }, [checkHasPin]);

  // Loading state
  if (isLoading && hasPin === null) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="w-6 h-6 border-2 border-lol-gold/30 border-t-lol-gold rounded-full animate-spin" />
      </div>
    );
  }

  // No PIN set — show setup
  if (hasPin === false) {
    return <AdminPinSetup onComplete={() => {}} />;
  }

  // PIN set but not verified — show keypad
  if (!isVerified) {
    return (
      <AdminPinKeypad
        onSubmit={verifyPin}
        title="Enter Admin PIN"
        subtitle="6-digit PIN required to access admin panel"
        isLoading={isLoading}
        error={error}
        lockedUntil={lockedUntil}
      />
    );
  }

  // Verified — show admin content
  return <>{children}</>;
}
