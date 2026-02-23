import { useState } from 'react';
import { Card } from '../ui';
import { ChampionIcon } from '../champion';
import { useChampionData } from '../../hooks/useChampionData';
import { BanCandidate } from './hooks/useDraftAnalytics';
import { TIERS, Role, ROLES } from '../../types';

interface BanPlanningPanelProps {
  banCandidates: BanCandidate[];
  currentBans: string[];
  onAddBan: (championId: string) => void;
  onRemoveBan: (championId: string) => void;
}

type TagFilter = 'all' | 'flex' | 'contested';

export default function BanPlanningPanel({
  banCandidates,
  currentBans,
  onAddBan,
  onRemoveBan,
}: BanPlanningPanelProps) {
  const { getChampionById } = useChampionData();
  const [roleFilter, setRoleFilter] = useState<Role | 'all'>('all');
  const [tagFilter, setTagFilter] = useState<TagFilter>('all');

  const getTierColor = (tier: string | null) => {
    if (!tier) return 'text-gray-400';
    return TIERS.find((t) => t.value === tier)?.color || 'text-gray-400';
  };

  const getRoleLabel = (role: Role) => {
    return ROLES.find((r) => r.value === role)?.label || role;
  };

  // Count flex and contested for badges
  const flexCount = banCandidates.filter((c) => c.isFlexPick).length;
  const contestedCount = banCandidates.filter((c) => c.isContested).length;

  // Filter candidates by role and tags
  const filteredCandidates = banCandidates.filter((candidate) => {
    // Role filter
    if (roleFilter !== 'all' && !candidate.players.some((p) => p.role === roleFilter)) {
      return false;
    }
    // Tag filter
    if (tagFilter === 'flex' && !candidate.isFlexPick) return false;
    if (tagFilter === 'contested' && !candidate.isContested) return false;
    return true;
  });

  // Separate into not-banned and already-banned
  const notBanned = filteredCandidates.filter((c) => !currentBans.includes(c.championId));

  return (
    <Card variant="bordered">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-red-400">Ban Suggestions</h3>
          <p className="text-xs text-gray-500 mt-0.5">Ranked by player count, flex potential, and contested status</p>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-2 mb-4">
        {/* Role Filter */}
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setRoleFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              roleFilter === 'all'
                ? 'bg-lol-gold/20 text-lol-gold border border-lol-gold/50'
                : 'bg-lol-dark text-gray-400 border border-lol-border hover:text-white hover:border-lol-border-light'
            }`}
          >
            All Roles
          </button>
          {ROLES.map((role) => (
            <button
              key={role.value}
              onClick={() => setRoleFilter(role.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                roleFilter === role.value
                  ? 'bg-lol-gold/20 text-lol-gold border border-lol-gold/50'
                  : 'bg-lol-dark text-gray-400 border border-lol-border hover:text-white hover:border-lol-border-light'
              }`}
            >
              {role.label}
            </button>
          ))}
        </div>

        {/* Tag Filter */}
        <div className="flex gap-1.5">
          <button
            onClick={() => setTagFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              tagFilter === 'all'
                ? 'bg-gray-500/20 text-white border border-gray-500/50'
                : 'bg-lol-dark text-gray-400 border border-lol-border hover:text-white hover:border-lol-border-light'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setTagFilter('flex')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              tagFilter === 'flex'
                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/50'
                : 'bg-lol-dark text-gray-400 border border-lol-border hover:text-purple-400 hover:border-purple-500/30'
            }`}
          >
            Flex
            {flexCount > 0 && (
              <span className="bg-purple-500/30 px-1.5 rounded text-[10px]">{flexCount}</span>
            )}
          </button>
          <button
            onClick={() => setTagFilter('contested')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              tagFilter === 'contested'
                ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50'
                : 'bg-lol-dark text-gray-400 border border-lol-border hover:text-yellow-400 hover:border-yellow-500/30'
            }`}
          >
            Contested
            {contestedCount > 0 && (
              <span className="bg-yellow-500/30 px-1.5 rounded text-[10px]">{contestedCount}</span>
            )}
          </button>
        </div>
      </div>

      {/* Ban Candidates */}
      {filteredCandidates.length === 0 ? (
        <p className="text-gray-500 text-sm py-4 text-center">
          {banCandidates.length === 0
            ? 'No enemy champion data available'
            : `No ${tagFilter === 'flex' ? 'flex picks' : tagFilter === 'contested' ? 'contested picks' : 'champions'} found`}
        </p>
      ) : (
        <div className="max-h-100 overflow-y-auto space-y-2 pr-1">
          {notBanned.map((candidate) => {
            const champion = getChampionById(candidate.championId);
            return (
              <div
                key={candidate.championId}
                className="p-3 bg-lol-dark rounded-lg hover:bg-lol-surface transition-colors group"
              >
                <div className="flex items-start gap-3">
                  <ChampionIcon championId={candidate.championId} size="md" />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white font-medium">
                        {champion?.name || candidate.championId}
                      </span>
                      {candidate.bestTier && (
                        <span className={`text-xs font-bold ${getTierColor(candidate.bestTier)}`}>
                          {candidate.bestTier}
                        </span>
                      )}
                      {candidate.isFlexPick && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded">
                          FLEX
                        </span>
                      )}
                      {candidate.isContested && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded">
                          CONTESTED
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      {candidate.players.map((p) => `${p.name} (${getRoleLabel(p.role)})`).join(', ')}
                    </div>
                  </div>

                  <button
                    onClick={() => onAddBan(candidate.championId)}
                    className="opacity-0 group-hover:opacity-100 px-2.5 py-1.5 bg-red-500/20 text-red-400 text-xs font-medium rounded hover:bg-red-500/30 transition-all"
                  >
                    Ban
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

          </Card>
  );
}
