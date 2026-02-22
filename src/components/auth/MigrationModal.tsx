import { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/useAuthStore';
import { migrationService, MigrationResult } from '../../lib/migration';
import Modal from '../ui/Modal';
import Button from '../ui/Button';

interface MigrationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MigrationModal({ isOpen, onClose }: MigrationModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<MigrationResult | null>(null);
  const [summary, setSummary] = useState<{ store: string; count: number }[]>([]);

  const { user } = useAuthStore();

  useEffect(() => {
    if (isOpen) {
      setSummary(migrationService.getMigrationSummary());
      setResult(null);
    }
  }, [isOpen]);

  const handleMigrate = async () => {
    setIsLoading(true);
    try {
      const migrationResult = await migrationService.migrateToCloud();
      setResult(migrationResult);

      if (migrationResult.success) {
        // Optionally clear localStorage after successful migration
        // migrationService.clearLocalStorage();
      }
    } catch (error) {
      setResult({
        success: false,
        migratedStores: [],
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartFresh = () => {
    if (user) {
      migrationService.markAsMigrated(user.id);
    }
    onClose();
  };

  const handleDone = () => {
    onClose();
    // Reload to sync with cloud data
    window.location.reload();
  };

  // Show result screen
  if (result) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Migration Complete">
        <div className="space-y-4">
          {result.success ? (
            <>
              <div className="flex items-center gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                <svg className="w-6 h-6 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <div className="font-medium text-green-400">Success!</div>
                  <div className="text-sm text-gray-400">Your data has been migrated to the cloud.</div>
                </div>
              </div>

              <div className="text-sm text-gray-400">
                <div className="font-medium text-white mb-2">Migrated:</div>
                <ul className="space-y-1">
                  {result.migratedStores.map((store) => (
                    <li key={store} className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {store}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <svg className="w-6 h-6 text-yellow-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <div className="font-medium text-yellow-400">Partial Migration</div>
                  <div className="text-sm text-gray-400">Some data couldn't be migrated.</div>
                </div>
              </div>

              {result.migratedStores.length > 0 && (
                <div className="text-sm text-gray-400">
                  <div className="font-medium text-white mb-2">Migrated:</div>
                  <ul className="space-y-1">
                    {result.migratedStores.map((store) => (
                      <li key={store} className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {store}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.errors.length > 0 && (
                <div className="text-sm">
                  <div className="font-medium text-white mb-2">Errors:</div>
                  <ul className="space-y-1 text-red-400">
                    {result.errors.map((error, i) => (
                      <li key={i}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          <Button variant="primary" className="w-full" onClick={handleDone}>
            Done
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Claim Your Data">
      <div className="space-y-4">
        <p className="text-gray-400">
          We found existing data saved in your browser. Would you like to migrate it to your cloud account?
        </p>

        {summary.length > 0 && (
          <div className="p-4 rounded-lg bg-lol-surface border border-lol-border">
            <div className="text-sm font-medium text-white mb-2">Data found:</div>
            <ul className="space-y-1 text-sm text-gray-400">
              {summary.map(({ store, count }) => (
                <li key={store} className="flex justify-between">
                  <span>{store}</span>
                  <span className="text-lol-gold">{count} item{count !== 1 ? 's' : ''}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex gap-3">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={handleStartFresh}
            disabled={isLoading}
          >
            Start Fresh
          </Button>
          <Button
            variant="primary"
            className="flex-1"
            onClick={handleMigrate}
            disabled={isLoading}
          >
            {isLoading ? 'Migrating...' : 'Claim Data'}
          </Button>
        </div>

        <p className="text-xs text-gray-500 text-center">
          Your local data will be preserved until you sign out.
        </p>
      </div>
    </Modal>
  );
}
