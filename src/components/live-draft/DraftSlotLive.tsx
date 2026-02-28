import { useChampionData } from '../../hooks/useChampionData';
import { getCenteredSplashUrl } from '../../lib/datadragon';
import { NONE_CHAMPION } from '../../types/liveDraft';
import type { DraftSide } from '../../types/liveDraft';

/** Helmet SVG placeholder for empty pick slots (TODO: replace with properly licensed icon) */
function HelmetIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 130 142" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M1 95.5C20.2 125.5 36.3333 137.667 42 140C29.6 116.8 36.8333 92.6667 42 83.5C25.6 78.7 24.5 61.1667 26 53C58 60.6 58.6667 78.8333 55 87C56.6 96.6 62.6667 104 65.5 106.5C72.7 97.7 74.8333 89.8333 75 87C68.2 64.6 91.8333 55 104.5 53C106.5 71.8 94.6667 81.1667 88.5 83.5C100.1 103.9 93.3333 129.667 88.5 140C107.7 127.2 123.5 105 129 95.5C108.2 79.9 111.333 48.3333 115.5 34.5C101.9 18.9 75.8333 5.66667 64.5 1C40.5 10.2 20.8333 27.1667 14 34.5C23.6 72.1 9.33333 90.8333 1 95.5Z" />
    </svg>
  );
}

interface DraftSlotLiveProps {
  type: 'ban' | 'pick';
  championId: string | null;
  side: DraftSide;
  isActive?: boolean;
  hoveredChampionId?: string | null;
  /** 'icon' = small square (bans), 'bar' = tall card with splash (picks) */
  variant?: 'icon' | 'bar';
  pickIndex?: number;
  /** Whether this timed-out slot can be clicked to fill */
  canFill?: boolean;
  /** Whether this slot is currently selected for filling */
  isFilling?: boolean;
  /** Called when a fillable timed-out slot is clicked */
  onFillClick?: () => void;
}

export default function DraftSlotLive({
  type,
  championId,
  side,
  isActive = false,
  hoveredChampionId = null,
  variant = 'icon',
  canFill = false,
  isFilling = false,
  onFillClick,
}: DraftSlotLiveProps) {
  const { getIconUrl, getChampionById } = useChampionData();

  const isNone = championId === NONE_CHAMPION;
  const displayChampionId = isNone ? null : (championId || (isActive ? hoveredChampionId : null));
  const champion = displayChampionId ? getChampionById(displayChampionId) : null;
  const isPreview = !championId && isActive && hoveredChampionId;

  // === BAN SLOT (small icon square) ===
  if (variant === 'icon') {
    const iconUrl = displayChampionId ? getIconUrl(displayChampionId) : null;

    return (
      <div
        className={`
          relative size-12 rounded-lg border-2 transition-all duration-200 bg-lol-dark/60
          ${isActive ? 'border-lol-gold/60 shadow-md shadow-lol-gold/20' : 'border-lol-border/50'}
          ${isPreview ? 'opacity-60' : ''}
        `}
      >
        {/* Normal champion ban icon */}
        {champion && iconUrl && (
          <img
            src={iconUrl}
            alt={champion.name}
            className={`w-full h-full rounded-md object-cover ${type === 'ban' && championId ? 'grayscale' : ''}`}
            title={champion.name}
          />
        )}

        {/* Ban none — helmet icon with X */}
        {isNone && type === 'ban' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <HelmetIcon className="w-7 h-7 text-gray-600" />
          </div>
        )}

        {type === 'ban' && championId && !isNone && (
          <div className="absolute inset-0 flex items-center justify-center">
            <svg className="w-full h-full text-gray-700/80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="4" y1="4" x2="20" y2="20" />
            </svg>
          </div>
        )}

        {isActive && !champion && !isNone && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-2.5 h-2.5 rounded-full bg-lol-gold/70 animate-ping" />
          </div>
        )}
      </div>
    );
  }

  // === PICK SLOT (tall card with splash art) ===
  const splashUrl = displayChampionId ? getCenteredSplashUrl(displayChampionId) : null;
  const isClickable = isNone && canFill && !isFilling;

  return (
    <div
      onClick={isClickable ? onFillClick : undefined}
      className={`
        relative w-full min-h-0 rounded-lg border-2 overflow-hidden transition-all duration-300
        bg-lol-dark/40
        ${isActive ? 'flex-[1.8] border-lol-gold/50 shadow-lg shadow-lol-gold/15' : isFilling ? 'flex-[1.8] border-lol-gold/60 shadow-lg shadow-lol-gold/20' : 'flex-1 border-lol-border/40'}
        ${isPreview ? 'opacity-70' : ''}
        ${isClickable ? 'cursor-pointer hover:border-lol-gold/40 hover:bg-lol-dark/60 group' : ''}
      `}
    >
      {/* Splash background */}
      {champion && splashUrl && (
        <img
          src={splashUrl}
          alt={champion.name}
          className="absolute inset-0 w-full h-full object-cover object-[center_15%] brightness-130"
        />
      )}

      {/* Darken overlay when filled */}
      {champion && <div className="absolute inset-0 bg-black/30" />}

      {/* Failed pick — timed out with no selection */}
      {isNone && !isFilling && (
        <div className={`absolute inset-0 flex flex-col items-center justify-center ${canFill ? 'bg-red-950/10' : 'bg-red-950/20'}`}>
          <HelmetIcon className={`w-10 h-10 ${canFill ? 'text-red-400/40 group-hover:text-lol-gold/50 transition-colors' : 'text-red-400/40'}`} />
          <span className={`text-[10px] font-medium mt-1 ${canFill ? 'text-red-400/60 group-hover:text-lol-gold/70 transition-colors' : 'text-red-400/60'}`}>
            {canFill ? 'Click to fill' : 'Timed out'}
          </span>
        </div>
      )}

      {/* Filling state — waiting for champion selection */}
      {isFilling && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-lol-gold/5">
          <HelmetIcon className="w-10 h-10 text-lol-gold/50 animate-pulse" />
          <span className="text-[10px] text-lol-gold/70 font-medium mt-1">Select champion</span>
        </div>
      )}

      {/* Empty state - helmet placeholder */}
      {!champion && !isActive && !isNone && !isFilling && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <HelmetIcon className="w-10 h-10 text-lol-border" />
        </div>
      )}

      {/* Active state - pulsing ring */}
      {isActive && !champion && !isNone && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <HelmetIcon className="w-10 h-10 text-lol-gold/40 animate-pulse" />
        </div>
      )}

      {/* Champion name on the outer edge */}
      {champion && (
        <div className={`absolute bottom-0 top-0 flex items-end pb-2 ${side === 'blue' ? 'left-0 pl-2.5' : 'right-0 pr-2.5'}`}>
          <div className="text-white text-sm font-bold drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
            {champion.name}
          </div>
        </div>
      )}

      {/* Active border glow */}
      {isActive && (
        <div className="absolute inset-0 rounded-lg border-2 border-lol-gold/50 animate-pulse pointer-events-none" />
      )}

      {/* Filling border glow */}
      {isFilling && (
        <div className="absolute inset-0 rounded-lg border-2 border-lol-gold/60 animate-pulse pointer-events-none" />
      )}
    </div>
  );
}
