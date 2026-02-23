import { useState, useMemo } from 'react';
import { Card } from '../ui';
import { ChampionIcon } from '../champion';
import { useChampionData } from '../../hooks/useChampionData';
import { ContestedChampion } from './hooks/useDraftAnalytics';
import { TIERS, ROLES, Role } from '../../types';

interface ContestedAnalysisProps {
  contested: ContestedChampion[];
  onAddBan: (championId: string) => void;
  onAddPriority?: (championId: string) => void;
}

export default function ContestedAnalysis({
  contested,
  onAddBan,
  onAddPriority,
}: ContestedAnalysisProps) {
  const { getChampionById } = useChampionData();
  const [roleFilter, setRoleFilter] = useState<Role | 'all'>('all');

  const filteredContested = useMemo(() => {
    if (roleFilter === 'all') return contested;
    return contested.filter((item) => {
      const allRoles = [
        ...item.myContext.map((ctx) => ctx.role),
        ...item.enemyContext.map((ctx) => ctx.role),
      ].filter(Boolean) as Role[];
      return allRoles.includes(roleFilter);
    });
  }, [contested, roleFilter]);

  const getTierColor = (tier: string) => {
    return TIERS.find((t) => t.value === tier)?.color || 'text-gray-400';
  };

  const getRoleLabel = (role: Role) => {
    return ROLES.find((r) => r.value === role)?.label || role;
  };

  const formatContext = (contexts: ContestedChampion['myContext'], maxShow: number = 2) => {
    const displayed = contexts.slice(0, maxShow);
    const remaining = contexts.length - maxShow;

    return (
      <span>
        {displayed.map((ctx, i) => (
          <span key={i}>
            {i > 0 && ', '}
            <span className="text-gray-300">
              {ctx.sourceType === 'custom' ? ctx.source : ctx.source}
            </span>
            {ctx.role && (
              <span className="text-gray-500"> ({getRoleLabel(ctx.role)})</span>
            )}
            {ctx.tier && (
              <span className={`ml-0.5 ${getTierColor(ctx.tier)}`}>{ctx.tier}</span>
            )}
          </span>
        ))}
        {remaining > 0 && (
          <span className="text-gray-500"> +{remaining}</span>
        )}
      </span>
    );
  };

  if (contested.length === 0) {
    return (
      <Card variant="bordered">
        <h3 className="text-lg font-semibold text-yellow-400 mb-2">Contested Picks</h3>
        <p className="text-xs text-gray-500 mb-3">Champions both teams want</p>
        <p className="text-gray-500 text-sm py-4 text-center">
          No overlapping champions found
        </p>
      </Card>
    );
  }

  return (
    <Card variant="bordered">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-yellow-400">Contested Picks</h3>
          <p className="text-xs text-gray-500 mt-0.5">Champions both teams want</p>
        </div>
        <span className="text-xs text-gray-500 bg-lol-dark px-2 py-1 rounded">
          {filteredContested.length}{roleFilter !== 'all' ? `/${contested.length}` : ''} found
        </span>
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

        {/* Spacer row to align with BanPlanningPanel */}
        <div className="flex gap-1.5 h-7.5" />
      </div>

      {filteredContested.length === 0 ? (
        <p className="text-gray-500 text-sm py-4 text-center">
          No contested picks match the selected roles
        </p>
      ) : (
      <div className="max-h-100 overflow-y-auto space-y-2 pr-1">
        {filteredContested.map((item) => {
          const champion = getChampionById(item.championId);
          return (
            <div
              key={item.championId}
              className="p-3 bg-lol-dark rounded-lg hover:bg-lol-surface transition-colors group"
            >
              <div className="flex items-start gap-3">
                <div className="relative">
                  <ChampionIcon championId={item.championId} size="md" />
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-500 rounded-full ring-2 ring-lol-dark" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-white font-medium mb-1">
                    {champion?.name || item.championId}
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <div>
                      <span className="text-blue-400 font-medium">US: </span>
                      {formatContext(item.myContext)}
                    </div>
                    <div>
                      <span className="text-red-400 font-medium">THEM: </span>
                      {formatContext(item.enemyContext)}
                    </div>
                  </div>
                </div>

                <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => onAddBan(item.championId)}
                    className="px-2.5 py-1.5 bg-red-500/20 text-red-400 text-xs font-medium rounded hover:bg-red-500/30 transition-colors"
                    title="Add to bans"
                  >
                    Ban
                  </button>
                  {onAddPriority && (
                    <button
                      onClick={() => onAddPriority(item.championId)}
                      className="px-2.5 py-1.5 bg-blue-500/20 text-blue-400 text-xs font-medium rounded hover:bg-blue-500/30 transition-colors"
                      title="Add to our priorities"
                    >
                      Priority
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      )}
    </Card>
  );
}
