import { useEffect, useRef, useState } from 'react';
import Button from '../ui/Button';

// Animated toggle switch component
function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onChange(); }}
      className={`
        relative w-9 h-5 rounded-full transition-colors duration-200 ease-in-out shrink-0
        ${checked ? 'bg-lol-gold' : 'bg-gray-600'}
      `}
      role="switch"
      aria-checked={checked}
    >
      <span
        className={`
          absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm
          transition-transform duration-200 ease-in-out
          ${checked ? 'translate-x-4' : 'translate-x-0'}
        `}
      />
    </button>
  );
}

interface TeamDetail {
  name: string;
  playerCount: number;
  playerNames: string[];
}

interface DraftDetail {
  name: string;
}

interface PlayerPoolDetail {
  summonerName: string;
  role: string;
  groupCount: number;
}

interface CustomPoolDetail {
  name: string;
  groupCount: number;
}

interface TemplateDetail {
  name: string;
}

export interface LocalDataSummary {
  myTeams: TeamDetail[];
  enemyTeams: TeamDetail[];
  drafts: DraftDetail[];
  playerPools: PlayerPoolDetail[];
  customPools: CustomPoolDetail[];
  templates: TemplateDetail[];
  hasData: boolean;
}

export interface ExcludedItems {
  myTeams: Set<number>;
  enemyTeams: Set<number>;
  drafts: Set<number>;
  playerPools: Set<number>;
  customPools: Set<number>;
  templates: Set<number>;
}

export interface AlreadyInCloud {
  myTeams: Set<number>;
  enemyTeams: Set<number>;
  drafts: Set<number>;
  playerPools: Set<number>;
  customPools: Set<number>;
  templates: Set<number>;
}

interface LocalDataMergeModalProps {
  isOpen: boolean;
  dataSummary: LocalDataSummary;
  alreadyInCloud?: AlreadyInCloud;
  onUpload: (excluded: ExcludedItems) => void;
  onDiscard: () => void;
}

export default function LocalDataMergeModal({
  isOpen,
  dataSummary,
  alreadyInCloud,
  onUpload,
  onDiscard,
}: LocalDataMergeModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [expanded, setExpanded] = useState<'myTeams' | 'enemyTeams' | 'drafts' | 'playerPools' | 'customPools' | 'templates' | null>(null);
  const [excluded, setExcluded] = useState<ExcludedItems>({
    myTeams: new Set(),
    enemyTeams: new Set(),
    drafts: new Set(),
    playerPools: new Set(),
    customPools: new Set(),
    templates: new Set(),
  });

  // Initialize excluded state from alreadyInCloud when modal opens
  useEffect(() => {
    if (isOpen && alreadyInCloud) {
      setExcluded({
        myTeams: new Set(alreadyInCloud.myTeams),
        enemyTeams: new Set(alreadyInCloud.enemyTeams),
        drafts: new Set(alreadyInCloud.drafts),
        playerPools: new Set(alreadyInCloud.playerPools),
        customPools: new Set(alreadyInCloud.customPools),
        templates: new Set(alreadyInCloud.templates),
      });
    } else if (isOpen) {
      // Reset excluded state when opening without alreadyInCloud
      setExcluded({
        myTeams: new Set(),
        enemyTeams: new Set(),
        drafts: new Set(),
        playerPools: new Set(),
        customPools: new Set(),
        templates: new Set(),
      });
    }
  }, [isOpen, alreadyInCloud]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleOverlayClick = () => {
    // Don't allow closing by clicking outside - user must make a choice
  };

  const handleUpload = async () => {
    setIsUploading(true);
    await onUpload(excluded);
    setIsUploading(false);
  };

  const toggleExclude = (category: keyof ExcludedItems, index: number) => {
    setExcluded(prev => {
      const newSet = new Set(prev[category]);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return { ...prev, [category]: newSet };
    });
  };

  const { myTeams, enemyTeams, drafts, playerPools, customPools, templates } = dataSummary;

  // Calculate remaining items after exclusions
  const remainingCount = {
    myTeams: myTeams.length - excluded.myTeams.size,
    enemyTeams: enemyTeams.length - excluded.enemyTeams.size,
    drafts: drafts.length - excluded.drafts.size,
    playerPools: playerPools.length - excluded.playerPools.size,
    customPools: customPools.length - excluded.customPools.size,
    templates: templates.length - excluded.templates.size,
  };

  const totalRemaining = Object.values(remainingCount).reduce((a, b) => a + b, 0);
  const hasRemainingData = totalRemaining > 0;

  const toggleExpand = (section: 'myTeams' | 'enemyTeams' | 'drafts' | 'playerPools' | 'customPools' | 'templates') => {
    setExpanded(expanded === section ? null : section);
  };

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="max-w-lg w-full mx-4 bg-lol-card border border-lol-border rounded-2xl shadow-2xl shadow-black/50 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 overflow-y-auto">
          {/* Icon */}
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-gradient-to-br from-lol-gold/20 to-lol-gold/5 flex items-center justify-center">
            <svg className="w-7 h-7 text-lol-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
            </svg>
          </div>

          {/* Title */}
          <h3 className="text-xl font-semibold text-white text-center mb-2">
            Local Data Found
          </h3>

          {/* Description */}
          <p className="text-gray-400 text-sm text-center mb-4">
            You have unsaved work from before logging in. What would you like to do with it?
          </p>

          {/* Data summary */}
          <div className="bg-lol-surface rounded-xl p-4 mb-6 space-y-3">
            <div className="text-sm text-gray-300 font-medium">Your local data:</div>

            {/* My Teams */}
            {myTeams.length > 0 && (
              <div className="bg-lol-dark/50 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleExpand('myTeams')}
                  className="w-full px-3 py-2 flex items-center justify-between hover:bg-lol-dark/30 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <svg className={`w-4 h-4 ${remainingCount.myTeams > 0 ? 'text-blue-400' : 'text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    <span className={`text-sm font-medium ${remainingCount.myTeams > 0 ? 'text-white' : 'text-gray-500'}`}>My Teams</span>
                    <span className="text-xs text-gray-400">({remainingCount.myTeams}/{myTeams.length})</span>
                  </div>
                  <svg
                    className={`w-4 h-4 text-gray-400 transition-transform ${expanded === 'myTeams' ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {expanded === 'myTeams' && (
                  <div className="px-3 pb-3 space-y-2">
                    {myTeams.map((team, i) => {
                      const isExcluded = excluded.myTeams.has(i);
                      const isInCloud = alreadyInCloud?.myTeams.has(i);
                      return (
                        <div key={i} className={`bg-lol-surface/50 rounded-lg p-2 flex items-start justify-between gap-3 transition-opacity duration-200 ${isExcluded ? 'opacity-40' : ''}`}>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-medium ${isExcluded ? 'text-gray-400' : 'text-white'}`}>{team.name}</span>
                              {isInCloud && <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">synced</span>}
                            </div>
                            {team.playerNames.length > 0 && (
                              <div className="text-xs text-gray-400 mt-1">
                                {team.playerNames.slice(0, 5).join(', ')}
                                {team.playerNames.length > 5 && ` +${team.playerNames.length - 5} more`}
                              </div>
                            )}
                          </div>
                          <ToggleSwitch checked={!isExcluded} onChange={() => toggleExclude('myTeams', i)} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Enemy Teams */}
            {enemyTeams.length > 0 && (
              <div className="bg-lol-dark/50 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleExpand('enemyTeams')}
                  className="w-full px-3 py-2 flex items-center justify-between hover:bg-lol-dark/30 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <svg className={`w-4 h-4 ${remainingCount.enemyTeams > 0 ? 'text-red-400' : 'text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <span className={`text-sm font-medium ${remainingCount.enemyTeams > 0 ? 'text-white' : 'text-gray-500'}`}>Enemy Teams</span>
                    <span className="text-xs text-gray-400">({remainingCount.enemyTeams}/{enemyTeams.length})</span>
                  </div>
                  <svg
                    className={`w-4 h-4 text-gray-400 transition-transform ${expanded === 'enemyTeams' ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {expanded === 'enemyTeams' && (
                  <div className="px-3 pb-3 space-y-2">
                    {enemyTeams.map((team, i) => {
                      const isExcluded = excluded.enemyTeams.has(i);
                      const isInCloud = alreadyInCloud?.enemyTeams.has(i);
                      return (
                        <div key={i} className={`bg-lol-surface/50 rounded-lg p-2 flex items-start justify-between gap-3 transition-opacity duration-200 ${isExcluded ? 'opacity-40' : ''}`}>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-medium ${isExcluded ? 'text-gray-400' : 'text-white'}`}>{team.name}</span>
                              {isInCloud && <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">synced</span>}
                            </div>
                            {team.playerNames.length > 0 && (
                              <div className="text-xs text-gray-400 mt-1">
                                {team.playerNames.slice(0, 5).join(', ')}
                                {team.playerNames.length > 5 && ` +${team.playerNames.length - 5} more`}
                              </div>
                            )}
                          </div>
                          <ToggleSwitch checked={!isExcluded} onChange={() => toggleExclude('enemyTeams', i)} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Drafts */}
            {drafts.length > 0 && (
              <div className="bg-lol-dark/50 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleExpand('drafts')}
                  className="w-full px-3 py-2 flex items-center justify-between hover:bg-lol-dark/30 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <svg className={`w-4 h-4 ${remainingCount.drafts > 0 ? 'text-lol-gold' : 'text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className={`text-sm font-medium ${remainingCount.drafts > 0 ? 'text-white' : 'text-gray-500'}`}>Draft Sessions</span>
                    <span className="text-xs text-gray-400">({remainingCount.drafts}/{drafts.length})</span>
                  </div>
                  <svg
                    className={`w-4 h-4 text-gray-400 transition-transform ${expanded === 'drafts' ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {expanded === 'drafts' && (
                  <div className="px-3 pb-3 space-y-2">
                    {drafts.map((draft, i) => {
                      const isExcluded = excluded.drafts.has(i);
                      const isInCloud = alreadyInCloud?.drafts.has(i);
                      return (
                        <div key={i} className={`bg-lol-surface/50 rounded-lg p-2 flex items-center justify-between gap-3 transition-opacity duration-200 ${isExcluded ? 'opacity-40' : ''}`}>
                          <div className="flex items-center gap-2">
                            <span className={`text-sm ${isExcluded ? 'text-gray-400' : 'text-white'}`}>{draft.name}</span>
                            {isInCloud && <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">synced</span>}
                          </div>
                          <ToggleSwitch checked={!isExcluded} onChange={() => toggleExclude('drafts', i)} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Player Pools */}
            {playerPools.length > 0 && (
              <div className="bg-lol-dark/50 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleExpand('playerPools')}
                  className="w-full px-3 py-2 flex items-center justify-between hover:bg-lol-dark/30 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <svg className={`w-4 h-4 ${remainingCount.playerPools > 0 ? 'text-purple-400' : 'text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <span className={`text-sm font-medium ${remainingCount.playerPools > 0 ? 'text-white' : 'text-gray-500'}`}>Player Pools</span>
                    <span className="text-xs text-gray-400">({remainingCount.playerPools}/{playerPools.length})</span>
                  </div>
                  <svg
                    className={`w-4 h-4 text-gray-400 transition-transform ${expanded === 'playerPools' ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {expanded === 'playerPools' && (
                  <div className="px-3 pb-3 space-y-2">
                    {playerPools.map((pool, i) => {
                      const isExcluded = excluded.playerPools.has(i);
                      const isInCloud = alreadyInCloud?.playerPools.has(i);
                      return (
                        <div key={i} className={`bg-lol-surface/50 rounded-lg p-2 flex items-start justify-between gap-3 transition-opacity duration-200 ${isExcluded ? 'opacity-40' : ''}`}>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-medium ${isExcluded ? 'text-gray-400' : 'text-white'}`}>{pool.summonerName}</span>
                              {isInCloud && <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">synced</span>}
                            </div>
                            <div className="text-xs text-gray-400 mt-1 capitalize">
                              {pool.role} · {pool.groupCount} group{pool.groupCount !== 1 ? 's' : ''}
                            </div>
                          </div>
                          <ToggleSwitch checked={!isExcluded} onChange={() => toggleExclude('playerPools', i)} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Custom Pools */}
            {customPools.length > 0 && (
              <div className="bg-lol-dark/50 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleExpand('customPools')}
                  className="w-full px-3 py-2 flex items-center justify-between hover:bg-lol-dark/30 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <svg className={`w-4 h-4 ${remainingCount.customPools > 0 ? 'text-green-400' : 'text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                    <span className={`text-sm font-medium ${remainingCount.customPools > 0 ? 'text-white' : 'text-gray-500'}`}>Custom Pools</span>
                    <span className="text-xs text-gray-400">({remainingCount.customPools}/{customPools.length})</span>
                  </div>
                  <svg
                    className={`w-4 h-4 text-gray-400 transition-transform ${expanded === 'customPools' ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {expanded === 'customPools' && (
                  <div className="px-3 pb-3 space-y-2">
                    {customPools.map((pool, i) => {
                      const isExcluded = excluded.customPools.has(i);
                      const isInCloud = alreadyInCloud?.customPools.has(i);
                      return (
                        <div key={i} className={`bg-lol-surface/50 rounded-lg p-2 flex items-start justify-between gap-3 transition-opacity duration-200 ${isExcluded ? 'opacity-40' : ''}`}>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-medium ${isExcluded ? 'text-gray-400' : 'text-white'}`}>{pool.name}</span>
                              {isInCloud && <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">synced</span>}
                            </div>
                            <div className="text-xs text-gray-400 mt-1">
                              {pool.groupCount} group{pool.groupCount !== 1 ? 's' : ''}
                            </div>
                          </div>
                          <ToggleSwitch checked={!isExcluded} onChange={() => toggleExclude('customPools', i)} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Templates */}
            {templates.length > 0 && (
              <div className="bg-lol-dark/50 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleExpand('templates')}
                  className="w-full px-3 py-2 flex items-center justify-between hover:bg-lol-dark/30 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <svg className={`w-4 h-4 ${remainingCount.templates > 0 ? 'text-cyan-400' : 'text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                    </svg>
                    <span className={`text-sm font-medium ${remainingCount.templates > 0 ? 'text-white' : 'text-gray-500'}`}>Templates</span>
                    <span className="text-xs text-gray-400">({remainingCount.templates}/{templates.length})</span>
                  </div>
                  <svg
                    className={`w-4 h-4 text-gray-400 transition-transform ${expanded === 'templates' ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {expanded === 'templates' && (
                  <div className="px-3 pb-3 space-y-2">
                    {templates.map((template, i) => {
                      const isExcluded = excluded.templates.has(i);
                      const isInCloud = alreadyInCloud?.templates.has(i);
                      return (
                        <div key={i} className={`bg-lol-surface/50 rounded-lg p-2 flex items-center justify-between gap-3 transition-opacity duration-200 ${isExcluded ? 'opacity-40' : ''}`}>
                          <div className="flex items-center gap-2">
                            <span className={`text-sm ${isExcluded ? 'text-gray-400' : 'text-white'}`}>{template.name}</span>
                            {isInCloud && <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">synced</span>}
                          </div>
                          <ToggleSwitch checked={!isExcluded} onChange={() => toggleExclude('templates', i)} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* No data message */}
          {!hasRemainingData && (
            <div className="text-center py-4 text-gray-400 text-sm">
              All items removed. Click "Discard" to continue with cloud data only.
            </div>
          )}

          {/* Actions */}
          <div className="space-y-3">
            <Button
              variant="primary"
              className="w-full"
              onClick={handleUpload}
              disabled={isUploading || !hasRemainingData}
            >
              {isUploading ? (
                <>
                  <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Uploading...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  <span>Upload {totalRemaining} item{totalRemaining !== 1 ? 's' : ''}</span>
                </>
              )}
            </Button>
            <Button
              variant="secondary"
              className="w-full"
              onClick={onDiscard}
              disabled={isUploading}
            >
              <svg className="w-4 h-4 mr-2 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span>Discard and use cloud data</span>
            </Button>
          </div>

          {/* Note */}
          <p className="text-xs text-gray-500 text-center mt-4">
            If you upload, your local data will be merged with any existing cloud data.
          </p>
        </div>
      </div>
    </div>
  );
}

// Utility to check for meaningful local data
export function getLocalDataSummary(): LocalDataSummary {
  const myTeams: TeamDetail[] = [];
  const enemyTeams: TeamDetail[] = [];
  const drafts: DraftDetail[] = [];
  const playerPools: PlayerPoolDetail[] = [];
  const customPools: CustomPoolDetail[] = [];
  const templates: TemplateDetail[] = [];

  try {
    // Check my teams
    const myTeamData = localStorage.getItem('teamcomp-lol-my-team');
    if (myTeamData) {
      const parsed = JSON.parse(myTeamData);
      const teams = parsed?.state?.teams || [];
      // Filter teams that have meaningful data (name changed or players with summoner names)
      teams.forEach((team: { name: string; players: { summonerName: string }[] }) => {
        const hasCustomName = team.name && team.name !== 'My Team';
        const playerNames = (team.players || [])
          .map((p: { summonerName: string }) => p.summonerName?.trim())
          .filter(Boolean);
        const hasPlayers = playerNames.length > 0;

        if (hasCustomName || hasPlayers) {
          myTeams.push({
            name: team.name || 'Unnamed Team',
            playerCount: playerNames.length,
            playerNames,
          });
        }
      });
    }

    // Check enemy teams
    const enemyTeamData = localStorage.getItem('teamcomp-lol-enemy-teams');
    if (enemyTeamData) {
      const parsed = JSON.parse(enemyTeamData);
      const teams = parsed?.state?.teams || [];
      teams.forEach((team: { name: string; players: { summonerName: string }[] }) => {
        const playerNames = (team.players || [])
          .map((p: { summonerName: string }) => p.summonerName?.trim())
          .filter(Boolean);

        enemyTeams.push({
          name: team.name || 'Unnamed Team',
          playerCount: playerNames.length,
          playerNames,
        });
      });
    }

    // Check drafts
    const draftData = localStorage.getItem('teamcomp-lol-drafts');
    if (draftData) {
      const parsed = JSON.parse(draftData);
      const sessions = parsed?.state?.sessions || [];
      sessions.forEach((session: { name: string }) => {
        drafts.push({
          name: session.name || 'Unnamed Draft',
        });
      });
    }

    // Check player pools
    const playerPoolData = localStorage.getItem('teamcomp-lol-player-pools');
    if (playerPoolData) {
      const parsed = JSON.parse(playerPoolData);
      const pools = parsed?.state?.pools || [];
      pools.forEach((pool: { summonerName: string; role: string; championGroups: unknown[] }) => {
        if (pool.summonerName?.trim()) {
          playerPools.push({
            summonerName: pool.summonerName,
            role: pool.role,
            groupCount: pool.championGroups?.length || 0,
          });
        }
      });
    }

    // Check custom pools
    const customPoolData = localStorage.getItem('teamcomp-lol-custom-pools');
    if (customPoolData) {
      const parsed = JSON.parse(customPoolData);
      const pools = parsed?.state?.pools || [];
      pools.forEach((pool: { name: string; championGroups: unknown[] }) => {
        customPools.push({
          name: pool.name || 'Unnamed Pool',
          groupCount: pool.championGroups?.length || 0,
        });
      });
    }

    // Check custom templates
    const templateData = localStorage.getItem('teamcomp-lol-custom-templates');
    if (templateData) {
      const parsed = JSON.parse(templateData);
      const templateList = parsed?.state?.templates || [];
      templateList.forEach((template: { name: string }) => {
        templates.push({
          name: template.name || 'Unnamed Template',
        });
      });
    }
  } catch (e) {
    console.error('Error reading local data:', e);
  }

  return {
    myTeams,
    enemyTeams,
    drafts,
    playerPools,
    customPools,
    templates,
    hasData: myTeams.length > 0 || enemyTeams.length > 0 || drafts.length > 0 ||
             playerPools.length > 0 || customPools.length > 0 || templates.length > 0,
  };
}

// Deep comparison helper
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a === b;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, i) => deepEqual(item, b[i]));
  }

  if (typeof a === 'object' && typeof b === 'object') {
    const aKeys = Object.keys(a as object);
    const bKeys = Object.keys(b as object);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every(key =>
      bKeys.includes(key) && deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])
    );
  }

  return false;
}

// Get local data with IDs for cloud comparison
export interface LocalDataWithIds {
  myTeams: Array<{ id: string; name: string; notes: string; players: Array<{ summonerName: string; role: string; championGroups: unknown }> }>;
  enemyTeams: Array<{ id: string; name: string; notes: string; players: Array<{ summonerName: string; role: string; championGroups: unknown }> }>;
  drafts: Array<{ id: string; name: string; enemyTeamId: string | null; myTeamId: string | null; banGroups: unknown; priorityGroups: unknown }>;
  playerPools: Array<{ id: string; summonerName: string; role: string; championGroups: unknown }>;
  customPools: Array<{ id: string; name: string; championGroups: unknown }>;
  templates: Array<{ id: string; name: string; groups: unknown }>;
}

export function getLocalDataWithIds(): LocalDataWithIds {
  const result: LocalDataWithIds = {
    myTeams: [],
    enemyTeams: [],
    drafts: [],
    playerPools: [],
    customPools: [],
    templates: [],
  };

  try {
    // My teams
    const myTeamData = localStorage.getItem('teamcomp-lol-my-team');
    if (myTeamData) {
      const parsed = JSON.parse(myTeamData);
      const teams = parsed?.state?.teams || [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      teams.forEach((team: any) => {
        const hasCustomName = team.name && team.name !== 'My Team';
        const hasPlayers = (team.players || []).some((p: { summonerName: string }) => p.summonerName?.trim());
        if (hasCustomName || hasPlayers) {
          result.myTeams.push({
            id: team.id,
            name: team.name || 'My Team',
            notes: team.notes || '',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            players: (team.players || []).filter((p: any) => p.summonerName?.trim()).map((p: any) => ({
              summonerName: p.summonerName,
              role: p.role,
              championGroups: p.championGroups || [],
            })),
          });
        }
      });
    }

    // Enemy teams
    const enemyTeamData = localStorage.getItem('teamcomp-lol-enemy-teams');
    if (enemyTeamData) {
      const parsed = JSON.parse(enemyTeamData);
      const teams = parsed?.state?.teams || [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      teams.forEach((team: any) => {
        result.enemyTeams.push({
          id: team.id,
          name: team.name || 'Enemy Team',
          notes: team.notes || '',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          players: (team.players || []).filter((p: any) => p.summonerName?.trim()).map((p: any) => ({
            summonerName: p.summonerName,
            role: p.role,
            championGroups: p.championGroups || [],
          })),
        });
      });
    }

    // Drafts
    const draftData = localStorage.getItem('teamcomp-lol-drafts');
    if (draftData) {
      const parsed = JSON.parse(draftData);
      const sessions = parsed?.state?.sessions || [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sessions.forEach((session: any) => {
        result.drafts.push({
          id: session.id,
          name: session.name || 'Unnamed Draft',
          enemyTeamId: session.enemyTeamId || null,
          myTeamId: session.myTeamId || null,
          banGroups: session.banGroups || [],
          priorityGroups: session.priorityGroups || [],
        });
      });
    }

    // Player pools
    const playerPoolData = localStorage.getItem('teamcomp-lol-player-pools');
    if (playerPoolData) {
      const parsed = JSON.parse(playerPoolData);
      const pools = parsed?.state?.pools || [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pools.forEach((pool: any) => {
        if (pool.summonerName?.trim()) {
          result.playerPools.push({
            id: pool.id,
            summonerName: pool.summonerName,
            role: pool.role,
            championGroups: pool.championGroups || [],
          });
        }
      });
    }

    // Custom pools
    const customPoolData = localStorage.getItem('teamcomp-lol-custom-pools');
    if (customPoolData) {
      const parsed = JSON.parse(customPoolData);
      const pools = parsed?.state?.pools || [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pools.forEach((pool: any) => {
        result.customPools.push({
          id: pool.id,
          name: pool.name || 'Unnamed Pool',
          championGroups: pool.championGroups || [],
        });
      });
    }

    // Templates
    const templateData = localStorage.getItem('teamcomp-lol-custom-templates');
    if (templateData) {
      const parsed = JSON.parse(templateData);
      const templateList = parsed?.state?.templates || [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      templateList.forEach((template: any) => {
        result.templates.push({
          id: template.id,
          name: template.name || 'Unnamed Template',
          groups: template.groups || [],
        });
      });
    }
  } catch (e) {
    console.error('Error reading local data with IDs:', e);
  }

  return result;
}

// Compare local data with cloud data and return indices of identical items
export function compareLocalWithCloud(
  localData: LocalDataWithIds,
  cloudData: {
    myTeams: Map<string, { name: string; notes: string; players: Array<{ summonerName: string; role: string; championGroups: unknown }> }>;
    enemyTeams: Map<string, { name: string; notes: string; players: Array<{ summonerName: string; role: string; championGroups: unknown }> }>;
    drafts: Map<string, { name: string; enemyTeamId: string | null; myTeamId: string | null; banGroups: unknown; priorityGroups: unknown }>;
    playerPools: Map<string, { summonerName: string; role: string; championGroups: unknown }>;
    customPools: Map<string, { name: string; championGroups: unknown }>;
    templates: Map<string, { name: string; groups: unknown }>;
  }
): AlreadyInCloud {
  const result: AlreadyInCloud = {
    myTeams: new Set(),
    enemyTeams: new Set(),
    drafts: new Set(),
    playerPools: new Set(),
    customPools: new Set(),
    templates: new Set(),
  };

  // Compare my teams
  localData.myTeams.forEach((localTeam, index) => {
    const cloudTeam = cloudData.myTeams.get(localTeam.id);
    if (cloudTeam) {
      // Compare name, notes, and players
      const playersMatch = localTeam.players.length === cloudTeam.players.length &&
        localTeam.players.every((localPlayer, i) => {
          const cloudPlayer = cloudTeam.players[i];
          if (!cloudPlayer) return false;
          return localPlayer.summonerName === cloudPlayer.summonerName &&
                 localPlayer.role === cloudPlayer.role &&
                 deepEqual(localPlayer.championGroups, cloudPlayer.championGroups);
        });

      if (localTeam.name === cloudTeam.name &&
          localTeam.notes === cloudTeam.notes &&
          playersMatch) {
        result.myTeams.add(index);
      }
    }
  });

  // Compare enemy teams
  localData.enemyTeams.forEach((localTeam, index) => {
    const cloudTeam = cloudData.enemyTeams.get(localTeam.id);
    if (cloudTeam) {
      const playersMatch = localTeam.players.length === cloudTeam.players.length &&
        localTeam.players.every((localPlayer, i) => {
          const cloudPlayer = cloudTeam.players[i];
          if (!cloudPlayer) return false;
          return localPlayer.summonerName === cloudPlayer.summonerName &&
                 localPlayer.role === cloudPlayer.role &&
                 deepEqual(localPlayer.championGroups, cloudPlayer.championGroups);
        });

      if (localTeam.name === cloudTeam.name &&
          localTeam.notes === cloudTeam.notes &&
          playersMatch) {
        result.enemyTeams.add(index);
      }
    }
  });

  // Compare drafts
  localData.drafts.forEach((localDraft, index) => {
    const cloudDraft = cloudData.drafts.get(localDraft.id);
    if (cloudDraft) {
      if (localDraft.name === cloudDraft.name &&
          localDraft.enemyTeamId === cloudDraft.enemyTeamId &&
          localDraft.myTeamId === cloudDraft.myTeamId &&
          deepEqual(localDraft.banGroups, cloudDraft.banGroups) &&
          deepEqual(localDraft.priorityGroups, cloudDraft.priorityGroups)) {
        result.drafts.add(index);
      }
    }
  });

  // Compare player pools
  localData.playerPools.forEach((localPool, index) => {
    const cloudPool = cloudData.playerPools.get(localPool.id);
    if (cloudPool) {
      if (localPool.summonerName === cloudPool.summonerName &&
          localPool.role === cloudPool.role &&
          deepEqual(localPool.championGroups, cloudPool.championGroups)) {
        result.playerPools.add(index);
      }
    }
  });

  // Compare custom pools
  localData.customPools.forEach((localPool, index) => {
    const cloudPool = cloudData.customPools.get(localPool.id);
    if (cloudPool) {
      if (localPool.name === cloudPool.name &&
          deepEqual(localPool.championGroups, cloudPool.championGroups)) {
        result.customPools.add(index);
      }
    }
  });

  // Compare templates
  localData.templates.forEach((localTemplate, index) => {
    const cloudTemplate = cloudData.templates.get(localTemplate.id);
    if (cloudTemplate) {
      if (localTemplate.name === cloudTemplate.name &&
          deepEqual(localTemplate.groups, cloudTemplate.groups)) {
        result.templates.add(index);
      }
    }
  });

  return result;
}

// Clear all local store data
// Note: We don't clear settings (user preferences) or auth state
export function clearAllLocalStores(): void {
  const storeKeys = [
    'teamcomp-lol-my-team',
    'teamcomp-lol-enemy-teams',
    'teamcomp-lol-drafts',
    'teamcomp-lol-player-pools',
    'teamcomp-lol-custom-pools',
    'teamcomp-lol-draft-theory',
    'teamcomp-lol-custom-templates',
  ];

  storeKeys.forEach((key) => {
    localStorage.removeItem(key);
  });

  // Force page reload to reset Zustand stores to initial state
  window.location.reload();
}
