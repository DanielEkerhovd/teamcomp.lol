import { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Button from '../ui/Button';

interface JoinTeamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJoin: (displayName: string) => void;
  teamName: string;
  defaultName?: string;
  isLoading?: boolean;
}

export default function JoinTeamModal({
  isOpen,
  onClose,
  onJoin,
  teamName,
  defaultName = '',
  isLoading = false,
}: JoinTeamModalProps) {
  const [displayName, setDisplayName] = useState(defaultName);

  // Reset/update display name when modal opens or default changes
  useEffect(() => {
    if (isOpen) {
      setDisplayName(defaultName);
    }
  }, [isOpen, defaultName]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = displayName.trim();
    if (trimmedName) {
      onJoin(trimmedName);
    }
  };

  const isValid = displayName.trim().length > 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Join as ${teamName}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-gray-400 text-sm">
          Enter your name to join as captain of {teamName}.
        </p>

        <Input
          label="Display Name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Enter your name"
          autoFocus
          maxLength={30}
        />

        <div className="flex gap-3">
          <Button
            type="button"
            variant="secondary"
            className="flex-1"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            className="flex-1"
            disabled={!isValid || isLoading}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Joining...
              </span>
            ) : (
              'Join Team'
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
