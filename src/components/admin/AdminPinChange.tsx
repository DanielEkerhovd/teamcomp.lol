import { useState } from 'react';
import AdminPinKeypad from './AdminPinKeypad';
import { useAdminSessionStore } from '../../stores/useAdminSessionStore';

interface AdminPinChangeProps {
  onComplete: () => void;
  onCancel: () => void;
}

export default function AdminPinChange({ onComplete, onCancel }: AdminPinChangeProps) {
  const [phase, setPhase] = useState<'current' | 'new' | 'confirm'>('current');
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { changePin, isLoading } = useAdminSessionStore();

  const handleCurrentPin = async (pin: string): Promise<{ error: string | null }> => {
    setOldPin(pin);
    setError(null);
    setPhase('new');
    return { error: null };
  };

  const handleNewPin = async (pin: string): Promise<{ error: string | null }> => {
    if (pin === oldPin) {
      setError('New PIN must be different from current PIN');
      return { error: 'New PIN must be different' };
    }
    setNewPin(pin);
    setError(null);
    setPhase('confirm');
    return { error: null };
  };

  const handleConfirm = async (pin: string): Promise<{ error: string | null }> => {
    if (pin !== newPin) {
      setError('PINs do not match. Please try again.');
      setNewPin('');
      setPhase('new');
      return { error: 'PINs do not match' };
    }

    const result = await changePin(oldPin, newPin);
    if (!result.error) {
      onComplete();
    } else {
      // If old PIN was wrong, go back to step 1
      if (result.error.includes('Incorrect')) {
        setOldPin('');
        setNewPin('');
        setPhase('current');
      }
    }
    return result;
  };

  return (
    <div className="relative">
      {/* Cancel button */}
      <button
        onClick={onCancel}
        className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors z-10"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
      </button>

      {phase === 'current' && (
        <AdminPinKeypad
          onSubmit={handleCurrentPin}
          title="Current PIN"
          subtitle="Enter your current admin PIN"
          isLoading={false}
          error={error}
        />
      )}
      {phase === 'new' && (
        <AdminPinKeypad
          onSubmit={handleNewPin}
          title="New PIN"
          subtitle="Choose your new 6-digit PIN"
          isLoading={false}
          error={error}
        />
      )}
      {phase === 'confirm' && (
        <AdminPinKeypad
          onSubmit={handleConfirm}
          title="Confirm New PIN"
          subtitle="Re-enter your new PIN to confirm"
          isLoading={isLoading}
          error={error}
        />
      )}
    </div>
  );
}
