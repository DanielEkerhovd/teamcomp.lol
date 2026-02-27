import { useState, useMemo } from 'react';
import { useChampionData } from '../../hooks/useChampionData';
import { championPlaysRole } from '../../data/championRoles';
import { ROLES } from '../../types';
import type { Role } from '../../types';
import RoleIcon from '../team/RoleIcon';

type RoleFilter = 'all' | Role;

interface DraftChampionGridProps {
  unavailableChampions: Set<string>;
  selectedChampion: string | null;
  onSelectChampion: (championId: string) => void;
  isMyTurn: boolean;
}

export default function DraftChampionGrid({
  unavailableChampions,
  selectedChampion,
  onSelectChampion,
  isMyTurn,
}: DraftChampionGridProps) {
  const { champions, loading, searchChampions, getIconUrl } = useChampionData();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');

  const filteredChampions = useMemo(() => {
    let filtered = search ? searchChampions(search) : champions;

    if (roleFilter !== 'all') {
      filtered = filtered.filter((c) => championPlaysRole(c.id, roleFilter));
    }

    return [...filtered].sort((a, b) => {
      const aUnavailable = unavailableChampions.has(a.id);
      const bUnavailable = unavailableChampions.has(b.id);
      if (aUnavailable !== bUnavailable) {
        return aUnavailable ? 1 : -1;
      }
      return a.name.localeCompare(b.name);
    });
  }, [champions, search, searchChampions, roleFilter, unavailableChampions]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-500">
        Loading champions...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full rounded-sm overflow-hidden">
      {/* Search and Filters */}
      <div className="flex items-center gap-3 px-3 py-2 border-b border-lol-border bg-lol-card rounded-t-sm">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search champions..."
            className="w-full px-3 py-1.5 bg-lol-dark rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-lol-gold/50"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Role Filters */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setRoleFilter('all')}
            className={`
              px-2.5 py-1.5 text-xs font-medium rounded-lg transition-all
              ${roleFilter === 'all'
                ? 'bg-lol-gold/20 text-lol-gold border border-lol-gold/50'
                : 'bg-lol-dark text-gray-400 border border-lol-border hover:text-white hover:border-lol-border-light'
              }
            `}
          >
            All
          </button>
          {ROLES.filter((r) => r.value !== 'flex').map((role) => (
            <button
              key={role.value}
              onClick={() => setRoleFilter(role.value)}
              className={`
                p-1.5 rounded-lg transition-all
                ${roleFilter === role.value
                  ? 'bg-lol-gold/20 border border-lol-gold/50'
                  : 'bg-lol-dark border border-lol-border hover:border-lol-border-light'
                }
              `}
              title={role.label}
            >
              <RoleIcon
                role={role.value}
                size="sm"
                className={roleFilter === role.value ? 'brightness-125' : 'opacity-60 hover:opacity-100'}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Champion Grid */}
      <div className="flex-1 overflow-y-auto p-3 bg-lol-dark/50">
        {filteredChampions.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            No champions found
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5 justify-center">
            {filteredChampions.map((champion) => {
              const isUnavailable = unavailableChampions.has(champion.id);
              const isSelected = selectedChampion === champion.id;

              return (
                <button
                  key={champion.id}
                  onClick={() => !isUnavailable && isMyTurn && onSelectChampion(champion.id)}
                  disabled={isUnavailable || !isMyTurn}
                  className={`
                    relative group transition-all duration-150 w-16 h-16 shrink-0
                    ${isUnavailable ? 'opacity-40 cursor-not-allowed' : 'hover:scale-105'}
                    ${isSelected ? 'ring-2 ring-lol-gold ring-offset-1 ring-offset-lol-dark' : ''}
                  `}
                  title={champion.name}
                >
                  <img
                    src={getIconUrl(champion.id)}
                    alt={champion.name}
                    className={`
                      w-16 h-16 rounded-md object-cover
                      ${isUnavailable ? 'grayscale brightness-75' : 'brightness-110'}
                      ${!isMyTurn && !isUnavailable ? 'opacity-70' : ''}
                    `}
                    loading="lazy"
                  />

                  {isUnavailable && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-full h-0.5 bg-red-500 rotate-45 transform" />
                    </div>
                  )}

                  <div className="absolute bottom-0 left-0 right-0 bg-black/80 text-white text-[10px] text-center py-0.5 opacity-0 group-hover:opacity-100 transition-opacity truncate rounded-b-md">
                    {champion.name}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
