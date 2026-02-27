import { Region, REGIONS } from '../../types';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { Modal } from '../ui';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { defaultRegion, setDefaultRegion } = useSettingsStore();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Settings" size="md">
      <div className="space-y-6">
        {/* Default Region */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Default Region
          </label>
          <select
            value={defaultRegion}
            onChange={(e) => setDefaultRegion(e.target.value as Region)}
            className="w-full px-4 py-3 bg-lol-dark border border-lol-border rounded-xl text-white focus:outline-none focus:border-lol-gold/50 focus:ring-2 focus:ring-lol-gold/20 transition-all duration-200"
          >
            {REGIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.value.toUpperCase()} - {r.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-2">
            Used when creating new players and teams
          </p>
        </div>

        {/* Divider */}
        <div className="border-t border-lol-border" />

        {/* App Info */}
        <div className="text-center text-gray-500 text-sm">
          <p>teamcomp.<span className="text-lol-gold">lol</span></p>
          <p className="text-xs mt-1">Draft planning and team management</p>
        </div>
      </div>
    </Modal>
  );
}
