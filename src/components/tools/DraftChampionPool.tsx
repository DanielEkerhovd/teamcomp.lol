import { useState, useMemo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { useChampionData } from '../../hooks/useChampionData';
import { getChampionRoles } from '../../data/championRoles';
import { Role } from '../../types';
import DraggableChampion from './DraggableChampion';

interface DraftChampionPoolProps {
  usedChampionIds: string[];
}

const ROLE_ICON_URLS: Record<Role, string> = {
  top: "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-top.png",
  jungle: "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-jungle.png",
  mid: "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-middle.png",
  adc: "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-bottom.png",
  support: "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-utility.png",
};

const ROLES: Role[] = ['top', 'jungle', 'mid', 'adc', 'support'];

export default function DraftChampionPool({ usedChampionIds }: DraftChampionPoolProps) {
  const { champions, searchChampions, loading } = useChampionData();
  const [search, setSearch] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<Role[]>([]);

  const { setNodeRef, isOver } = useDroppable({
    id: 'pool',
  });

  const filteredChampions = useMemo(() => {
    let result = search ? searchChampions(search) : champions;

    // Filter out used champions
    result = result.filter((c) => !usedChampionIds.includes(c.id));

    // Filter by selected roles
    if (selectedRoles.length > 0) {
      result = result.filter((c) => {
        const champRoles = getChampionRoles(c.id);
        return selectedRoles.some((role) => champRoles.includes(role));
      });
    }

    // Sort alphabetically
    return [...result].sort((a, b) => a.name.localeCompare(b.name));
  }, [champions, search, searchChampions, selectedRoles, usedChampionIds]);

  const toggleRole = (role: Role) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading champions...</div>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      className={`
        flex flex-col h-full min-h-0 bg-lol-card rounded-lg border border-lol-border p-4
        ${isOver ? 'border-lol-gold' : ''}
      `}
    >
      {/* Search */}
      <div className="mb-3 shrink-0">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search champions..."
          className="w-full px-3 py-2 bg-lol-dark border border-lol-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-lol-gold"
        />
      </div>

      {/* Role filters */}
      <div className="flex gap-1 mb-3 flex-wrap shrink-0">
        {ROLES.map((role) => (
          <button
            key={role}
            onClick={() => toggleRole(role)}
            className={`
              p-1.5 rounded-md transition-colors
              ${
                selectedRoles.includes(role)
                  ? 'bg-lol-gold/20 ring-1 ring-lol-gold'
                  : 'bg-lol-dark hover:bg-lol-surface'
              }
            `}
            title={role.charAt(0).toUpperCase() + role.slice(1)}
          >
            <img
              src={ROLE_ICON_URLS[role]}
              alt={role}
              className="w-5 h-5 object-contain"
            />
          </button>
        ))}
        {selectedRoles.length > 0 && (
          <button
            onClick={() => setSelectedRoles([])}
            className="px-2 py-1 text-xs rounded-md bg-gray-700 text-gray-300 hover:bg-gray-600"
          >
            Clear
          </button>
        )}
      </div>

      {/* Champion grid */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="flex flex-wrap gap-2 content-start">
          {filteredChampions.map((champion) => (
            <DraggableChampion
              key={champion.id}
              championId={champion.id}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
