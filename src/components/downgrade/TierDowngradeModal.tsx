import { useEffect, useRef, useState } from 'react';
import Button from '../ui/Button';
import type { ContentItem } from '../../lib/downgradeService';
import { FREE_TIER_MAX_TEAMS, FREE_TIER_MAX_ENEMY_TEAMS, FREE_TIER_MAX_DRAFTS } from '../../stores/useAuthStore';
import { createCheckoutSession, STRIPE_PRICES, isStripeConfigured } from '../../lib/stripeService';

function ToggleSwitch({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); if (!disabled) onChange(); }}
      className={`
        relative w-9 h-5 rounded-full transition-colors duration-200 ease-in-out shrink-0
        ${disabled ? 'opacity-40 cursor-not-allowed' : ''}
        ${checked ? 'bg-lol-gold' : 'bg-gray-600'}
      `}
      role="switch"
      aria-checked={checked}
      disabled={disabled}
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

type ContentCategory = 'myTeams' | 'enemyTeams' | 'drafts';

export interface TierDowngradeModalProps {
  isOpen: boolean;
  downgradedAt: string;
  contentData: {
    myTeams: ContentItem[];
    enemyTeams: ContentItem[];
    drafts: ContentItem[];
  };
  onConfirm: (kept: { teamIds: string[]; enemyTeamIds: string[]; draftIds: string[] }) => Promise<void>;
  onResubscribed: () => void;
  /** When true, shows a test banner, disables Stripe checkout, and adds a close button. No data changes. */
  testMode?: boolean;
}

function getGracePeriodRemaining(downgradedAt: string): { days: number; hours: number; expired: boolean } {
  const downgradeDate = new Date(downgradedAt);
  const expiresAt = new Date(downgradeDate.getTime() + 7 * 24 * 60 * 60 * 1000);
  const now = new Date();
  const remaining = expiresAt.getTime() - now.getTime();

  if (remaining <= 0) return { days: 0, hours: 0, expired: true };

  const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
  const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  return { days, hours, expired: false };
}

const LIMITS: Record<ContentCategory, number> = {
  myTeams: FREE_TIER_MAX_TEAMS,
  enemyTeams: FREE_TIER_MAX_ENEMY_TEAMS,
  drafts: FREE_TIER_MAX_DRAFTS,
};

export default function TierDowngradeModal({
  isOpen,
  downgradedAt,
  contentData,
  onConfirm,
  onResubscribed,
  testMode = false,
}: TierDowngradeModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<ContentCategory | null>(null);

  // Track which items are SELECTED (kept) — by ID
  const [selectedTeams, setSelectedTeams] = useState<Set<string>>(new Set());
  const [selectedEnemyTeams, setSelectedEnemyTeams] = useState<Set<string>>(new Set());
  const [selectedDrafts, setSelectedDrafts] = useState<Set<string>>(new Set());

  // Initialize selections: pre-select the most recently updated items up to the free limit
  useEffect(() => {
    if (!isOpen) return;

    // Content is already sorted by updated_at desc from the service
    setSelectedTeams(new Set(
      contentData.myTeams.slice(0, LIMITS.myTeams).map(t => t.id)
    ));
    setSelectedEnemyTeams(new Set(
      contentData.enemyTeams.slice(0, LIMITS.enemyTeams).map(t => t.id)
    ));
    setSelectedDrafts(new Set(
      contentData.drafts.slice(0, LIMITS.drafts).map(d => d.id)
    ));
  }, [isOpen, contentData]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  const gracePeriod = getGracePeriodRemaining(downgradedAt);

  const toggleSelect = (category: ContentCategory, id: string) => {
    const setterMap = {
      myTeams: setSelectedTeams,
      enemyTeams: setSelectedEnemyTeams,
      drafts: setSelectedDrafts,
    };
    const currentMap = {
      myTeams: selectedTeams,
      enemyTeams: selectedEnemyTeams,
      drafts: selectedDrafts,
    };

    const current = currentMap[category];
    const limit = LIMITS[category];
    const setter = setterMap[category];

    if (current.has(id)) {
      // Deselect
      const next = new Set(current);
      next.delete(id);
      setter(next);
    } else {
      // Select — enforce limit
      if (current.size >= limit) return; // Can't select more
      const next = new Set(current);
      next.add(id);
      setter(next);
    }
  };

  const handleConfirm = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await onConfirm({
        teamIds: Array.from(selectedTeams),
        enemyTeamIds: Array.from(selectedEnemyTeams),
        draftIds: Array.from(selectedDrafts),
      });
    } catch {
      setError('Failed to save selection. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResubscribe = async () => {
    if (testMode) return; // No-op in test mode
    setCheckoutLoading(true);
    setError(null);
    try {
      const result = await createCheckoutSession({
        mode: 'subscription',
        priceId: STRIPE_PRICES.pro,
      });
      if (result.error) {
        setError(result.error);
      } else {
        onResubscribed();
      }
    } catch {
      setError('Failed to start checkout. Please try again.');
    } finally {
      setCheckoutLoading(false);
    }
  };

  const isOverLimit = (category: ContentCategory) =>
    contentData[category].length > LIMITS[category];

  const overLimitCategories = (['myTeams', 'enemyTeams', 'drafts'] as ContentCategory[])
    .filter(c => isOverLimit(c));

  const toggleExpand = (section: ContentCategory) => {
    setExpanded(expanded === section ? null : section);
  };

  const renderSection = (
    category: ContentCategory,
    label: string,
    items: ContentItem[],
    selected: Set<string>,
    icon: React.ReactNode,
    colorClass: string,
  ) => {
    if (!isOverLimit(category)) return null;
    const limit = LIMITS[category];

    return (
      <div className="bg-lol-dark/50 rounded-lg overflow-hidden">
        <button
          onClick={() => toggleExpand(category)}
          className="w-full px-3 py-2 flex items-center justify-between hover:bg-lol-dark/30 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className={`w-4 h-4 ${colorClass}`}>{icon}</span>
            <span className="text-sm font-medium text-white">{label}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded ${
              selected.size === limit ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'
            }`}>
              {selected.size}/{limit}
            </span>
            <span className="text-xs text-gray-500">of {items.length}</span>
          </div>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${expanded === category ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {expanded === category && (
          <div className="px-3 pb-3 space-y-2 max-h-60 overflow-y-auto">
            {items.map((item) => {
              const isSelected = selected.has(item.id);
              const atLimit = selected.size >= limit;
              const disabled = !isSelected && atLimit;

              return (
                <div
                  key={item.id}
                  className={`bg-lol-surface/50 rounded-lg p-2 flex items-start justify-between gap-3 transition-opacity duration-200 ${
                    !isSelected ? 'opacity-40' : ''
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <span className={`text-sm font-medium ${isSelected ? 'text-white' : 'text-gray-400'}`}>
                      {item.name}
                    </span>
                    {item.playerNames && item.playerNames.length > 0 && (
                      <div className="text-xs text-gray-400 mt-1">
                        {item.playerNames.slice(0, 5).join(', ')}
                        {item.playerNames.length > 5 && ` +${item.playerNames.length - 5} more`}
                      </div>
                    )}
                  </div>
                  <ToggleSwitch
                    checked={isSelected}
                    onChange={() => toggleSelect(category, item.id)}
                    disabled={disabled}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // Icons
  const teamIcon = (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );

  const enemyIcon = (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );

  const draftIcon = (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );

  // Check if selection is valid
  const allCategoriesValid = overLimitCategories.every(category => {
    const selected = { myTeams: selectedTeams, enemyTeams: selectedEnemyTeams, drafts: selectedDrafts }[category];
    return selected.size > 0;
  });

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="max-w-lg w-full mx-4 bg-lol-card border border-lol-border rounded-2xl shadow-2xl shadow-black/50 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 overflow-y-auto">
          {/* Test mode banner */}
          {testMode && (
            <div className="bg-orange-500/15 border border-orange-500/40 rounded-lg px-3 py-2 mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-orange-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-xs font-semibold text-orange-300 uppercase tracking-wide">Test Mode — No data will be changed</span>
              </div>
              <button
                onClick={onResubscribed}
                className="text-gray-400 hover:text-white transition-colors p-0.5"
                title="Close test modal"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* Icon */}
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-gradient-to-br from-amber-500/20 to-amber-500/5 flex items-center justify-center">
            <svg className="w-7 h-7 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>

          {/* Title */}
          <h3 className="text-xl font-semibold text-white text-center mb-2">
            Subscription Expired
          </h3>

          {/* Description */}
          <p className="text-gray-400 text-sm text-center mb-4">
            Your plan has been downgraded to Free. You have more content than the free plan allows.
            Choose what to keep, or resubscribe to retain everything.
          </p>

          {/* Grace period banner */}
          <div className={`rounded-lg p-3 mb-4 ${
            gracePeriod.expired
              ? 'bg-red-500/10 border border-red-500/30'
              : 'bg-amber-500/10 border border-amber-500/30'
          }`}>
            <div className="flex items-center gap-2">
              <svg className={`w-4 h-4 shrink-0 ${gracePeriod.expired ? 'text-red-400' : 'text-amber-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className={`text-sm ${gracePeriod.expired ? 'text-red-300' : 'text-amber-300'}`}>
                {gracePeriod.expired
                  ? 'Grace period expired. Unselected content will be deleted soon.'
                  : `${gracePeriod.days}d ${gracePeriod.hours}h remaining to resubscribe and keep all your content`
                }
              </span>
            </div>
          </div>

          {/* Limits overview */}
          <div className="bg-lol-surface rounded-xl p-4 mb-4 space-y-1.5">
            <div className="text-sm text-gray-300 font-medium mb-2">Free plan limits:</div>
            {isOverLimit('myTeams') && (
              <div className="text-sm text-gray-400">
                <span className="text-red-400">{contentData.myTeams.length}</span>/{LIMITS.myTeams} teams
              </div>
            )}
            {isOverLimit('enemyTeams') && (
              <div className="text-sm text-gray-400">
                <span className="text-red-400">{contentData.enemyTeams.length}</span>/{LIMITS.enemyTeams} enemy teams
              </div>
            )}
            {isOverLimit('drafts') && (
              <div className="text-sm text-gray-400">
                <span className="text-red-400">{contentData.drafts.length}</span>/{LIMITS.drafts} drafts
              </div>
            )}
          </div>

          {/* Content selection */}
          <div className="space-y-3 mb-6">
            <div className="text-sm text-gray-300 font-medium">Select what to keep:</div>
            {renderSection('myTeams', 'My Teams', contentData.myTeams, selectedTeams, teamIcon, 'text-blue-400')}
            {renderSection('enemyTeams', 'Enemy Teams', contentData.enemyTeams, selectedEnemyTeams, enemyIcon, 'text-red-400')}
            {renderSection('drafts', 'Draft Sessions', contentData.drafts, selectedDrafts, draftIcon, 'text-lol-gold')}
          </div>

          {/* Error message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-3">
            {isStripeConfigured && (
              <Button
                variant="primary"
                className="w-full"
                onClick={handleResubscribe}
                disabled={testMode || checkoutLoading || isSubmitting}
              >
                {checkoutLoading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Loading...</span>
                  </>
                ) : (
                  <span>Resubscribe</span>
                )}
              </Button>
            )}
            <Button
              variant="secondary"
              className="w-full"
              onClick={handleConfirm}
              disabled={isSubmitting || checkoutLoading || !allCategoriesValid}
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Saving...</span>
                </>
              ) : (
                <span>Confirm Selection</span>
              )}
            </Button>
          </div>

          {/* Warning note */}
          <p className="text-xs text-gray-500 text-center mt-4">
            Unselected content will be archived for 7 days. If you resubscribe within that time, all content will be restored.
            After 7 days, archived content is permanently deleted.
          </p>
        </div>
      </div>
    </div>
  );
}
