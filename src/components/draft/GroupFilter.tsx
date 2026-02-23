import { ChampionTier, TIERS } from '../../types';
import { GroupInfo } from './hooks/useDraftAnalytics';

interface GroupFilterProps {
  // Tier filtering
  selectedTiers: ChampionTier[];
  onTierToggle: (tier: ChampionTier) => void;

  // Group filtering (optional)
  availableGroups?: GroupInfo[];
  selectedGroupIds?: string[];
  onGroupToggle?: (groupId: string) => void;

  // Compact mode
  compact?: boolean;
}

export default function GroupFilter({
  selectedTiers,
  onTierToggle,
  availableGroups = [],
  selectedGroupIds = [],
  onGroupToggle,
  compact = false,
}: GroupFilterProps) {
  const myGroups = availableGroups.filter((g) => g.side === 'my');
  const enemyGroups = availableGroups.filter((g) => g.side === 'enemy');

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">Tiers:</span>
        <div className="flex gap-1">
          {TIERS.map((tier) => {
            const isSelected = selectedTiers.includes(tier.value);
            return (
              <button
                key={tier.value}
                onClick={() => onTierToggle(tier.value)}
                className={`w-7 h-7 rounded text-xs font-bold transition-all ${
                  isSelected
                    ? `${tier.color} bg-lol-surface border border-lol-border-light`
                    : 'text-gray-600 bg-lol-dark border border-lol-border hover:text-gray-400'
                }`}
              >
                {tier.value}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Tier Filter */}
      <div>
        <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
          Tiers
        </h4>
        <div className="flex gap-1.5">
          {TIERS.map((tier) => {
            const isSelected = selectedTiers.includes(tier.value);
            return (
              <button
                key={tier.value}
                onClick={() => onTierToggle(tier.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
                  isSelected
                    ? `${tier.color} bg-lol-surface border border-lol-border-light`
                    : 'text-gray-600 bg-lol-dark border border-lol-border hover:text-gray-400 hover:border-lol-border-light'
                }`}
              >
                {tier.value}
              </button>
            );
          })}
        </div>
      </div>

      {/* Group Filters */}
      {onGroupToggle && myGroups.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
            My Team Groups
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {myGroups.map((group) => {
              const isSelected = selectedGroupIds.includes(group.id);
              return (
                <button
                  key={group.id}
                  onClick={() => onGroupToggle(group.id)}
                  className={`px-2.5 py-1 rounded text-xs transition-all ${
                    isSelected
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
                      : 'bg-lol-dark text-gray-500 border border-lol-border hover:text-gray-300 hover:border-lol-border-light'
                  }`}
                  title={`${group.source}`}
                >
                  {group.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {onGroupToggle && enemyGroups.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
            Enemy Groups
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {enemyGroups.map((group) => {
              const isSelected = selectedGroupIds.includes(group.id);
              return (
                <button
                  key={group.id}
                  onClick={() => onGroupToggle(group.id)}
                  className={`px-2.5 py-1 rounded text-xs transition-all ${
                    isSelected
                      ? 'bg-red-500/20 text-red-400 border border-red-500/50'
                      : 'bg-lol-dark text-gray-500 border border-lol-border hover:text-gray-300 hover:border-lol-border-light'
                  }`}
                  title={`${group.source}`}
                >
                  {group.name}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
