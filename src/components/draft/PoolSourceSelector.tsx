import { useState } from 'react';
import { Team, CustomPool } from '../../types';

interface PoolSourceSelectorProps {
  // My team
  myTeam: Team | null;
  includeMyTeam: boolean;
  onToggleMyTeam: () => void;

  // Enemy teams
  enemyTeams: Team[];
  selectedEnemyTeamId: string | null;
  onSelectEnemyTeam: (teamId: string | null) => void;

  // Custom pools
  customPools: CustomPool[];
  selectedCustomPoolIds: string[];
  onToggleCustomPool: (poolId: string) => void;
}

export default function PoolSourceSelector({
  myTeam,
  includeMyTeam,
  onToggleMyTeam,
  enemyTeams,
  selectedEnemyTeamId,
  onSelectEnemyTeam,
  customPools,
  selectedCustomPoolIds,
  onToggleCustomPool,
}: PoolSourceSelectorProps) {
  const [showCustomPools, setShowCustomPools] = useState(false);

  const selectedEnemyTeam = enemyTeams.find((t) => t.id === selectedEnemyTeamId);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* My Team Toggle */}
      {myTeam && (
        <button
          onClick={onToggleMyTeam}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
            includeMyTeam
              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
              : 'bg-lol-dark text-gray-500 border border-lol-border hover:text-gray-300 hover:border-lol-border-light'
          }`}
        >
          {includeMyTeam && (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          )}
          <span>My Team</span>
          {myTeam.name && <span className="text-xs opacity-70">({myTeam.name})</span>}
        </button>
      )}

      {/* Enemy Team Selector */}
      <div className="relative">
        <select
          value={selectedEnemyTeamId || ''}
          onChange={(e) => onSelectEnemyTeam(e.target.value || null)}
          className={`appearance-none px-3 py-2 pr-8 rounded-lg text-sm font-medium transition-all cursor-pointer ${
            selectedEnemyTeamId
              ? 'bg-red-500/20 text-red-400 border border-red-500/50'
              : 'bg-lol-dark text-gray-500 border border-lol-border hover:text-gray-300 hover:border-lol-border-light'
          }`}
        >
          <option value="">Select Enemy Team</option>
          {enemyTeams.map((team) => (
            <option key={team.id} value={team.id}>
              vs {team.name}
            </option>
          ))}
        </select>
        <svg
          className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Custom Pools Dropdown */}
      {customPools.length > 0 && (
        <div className="relative">
          <button
            onClick={() => setShowCustomPools(!showCustomPools)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              selectedCustomPoolIds.length > 0
                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/50'
                : 'bg-lol-dark text-gray-500 border border-lol-border hover:text-gray-300 hover:border-lol-border-light'
            }`}
          >
            <span>Custom Pools</span>
            {selectedCustomPoolIds.length > 0 && (
              <span className="bg-purple-500/30 px-1.5 py-0.5 rounded text-xs">
                {selectedCustomPoolIds.length}
              </span>
            )}
            <svg
              className={`w-4 h-4 transition-transform ${showCustomPools ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showCustomPools && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowCustomPools(false)}
              />

              {/* Dropdown */}
              <div className="absolute top-full left-0 mt-1 z-20 min-w-48 bg-lol-card border border-lol-border rounded-lg shadow-xl overflow-hidden">
                <div className="p-2 space-y-1">
                  {customPools.map((pool) => {
                    const isSelected = selectedCustomPoolIds.includes(pool.id);
                    return (
                      <button
                        key={pool.id}
                        onClick={() => onToggleCustomPool(pool.id)}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-all ${
                          isSelected
                            ? 'bg-purple-500/20 text-purple-400'
                            : 'text-gray-400 hover:bg-lol-surface hover:text-white'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                            isSelected
                              ? 'border-purple-500 bg-purple-500'
                              : 'border-gray-600'
                          }`}
                        >
                          {isSelected && (
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                        <span>{pool.name}</span>
                        <span className="text-xs text-gray-500 ml-auto">
                          {pool.championGroups.reduce((sum, g) => sum + g.championIds.length, 0)} champs
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Active Source Tags */}
      {(includeMyTeam || selectedEnemyTeamId || selectedCustomPoolIds.length > 0) && (
        <div className="flex items-center gap-1 ml-2 pl-2 border-l border-lol-border">
          <span className="text-xs text-gray-500">Sources:</span>
          {includeMyTeam && (
            <span className="text-xs px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded">
              {myTeam?.name || 'My Team'}
            </span>
          )}
          {selectedEnemyTeam && (
            <span className="text-xs px-2 py-0.5 bg-red-500/10 text-red-400 rounded">
              vs {selectedEnemyTeam.name}
            </span>
          )}
          {selectedCustomPoolIds.map((poolId) => {
            const pool = customPools.find((p) => p.id === poolId);
            return pool ? (
              <span
                key={poolId}
                className="text-xs px-2 py-0.5 bg-purple-500/10 text-purple-400 rounded"
              >
                {pool.name}
              </span>
            ) : null;
          })}
        </div>
      )}
    </div>
  );
}
