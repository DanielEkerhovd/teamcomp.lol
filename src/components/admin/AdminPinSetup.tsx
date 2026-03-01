import { useState } from 'react';
import AdminPinKeypad from './AdminPinKeypad';
import { useAdminSessionStore } from '../../stores/useAdminSessionStore';

interface AdminPinSetupProps {
  onComplete: () => void;
}

export default function AdminPinSetup({ onComplete }: AdminPinSetupProps) {
  const [phase, setPhase] = useState<'create' | 'confirm'>('create');
  const [firstPin, setFirstPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { setupPin, isLoading } = useAdminSessionStore();

  const handleCreate = async (pin: string): Promise<{ error: string | null }> => {
    setFirstPin(pin);
    setError(null);
    setPhase('confirm');
    return { error: null };
  };

  const handleConfirm = async (pin: string): Promise<{ error: string | null }> => {
    if (pin !== firstPin) {
      setError('PINs do not match. Please try again.');
      setPhase('create');
      setFirstPin('');
      return { error: 'PINs do not match' };
    }

    const result = await setupPin(pin);
    if (!result.error) {
      onComplete();
    }
    return result;
  };

  if (phase === 'create') {
    return (
      <AdminPinKeypad
        onSubmit={handleCreate}
        title="Create Admin PIN"
        subtitle="Choose a 6-digit PIN to secure the admin panel"
        isLoading={false}
        error={error}
      />
    );
  }

  return (
    <AdminPinKeypad
      onSubmit={handleConfirm}
      title="Confirm Admin PIN"
      subtitle="Re-enter your PIN to confirm"
      isLoading={isLoading}
      error={error}
    />
  );
}
