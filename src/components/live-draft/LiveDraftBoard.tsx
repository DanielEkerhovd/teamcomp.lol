import { useRef, useEffect } from 'react';
import DraftSlotLive from './DraftSlotLive';
import DraftHeader from './DraftHeader';
import DraftChampionGrid from './DraftChampionGrid';
import FearlessBar from './FearlessBar';
import type { LiveDraftSession, LiveDraftGame, DraftSide, DbLiveDraftUnavailableChampion } from '../../types/liveDraft';
import { DRAFT_ORDER, NONE_CHAMPION } from '../../types/liveDraft';
import type { DraftSession } from '../../types';

export interface FillingSlot {
  side: DraftSide;
  type: 'ban' | 'pick';
  index: number;
}

interface LiveDraftBoardProps {
  session: LiveDraftSession;
  game: LiveDraftGame;
  isMyTurn: boolean;
  mySide: DraftSide | null;
  selectedChampion: string | null;
  opponentHoveredChampion: string | null;
  onSelectChampion: (championId: string) => void;
  onLockIn: () => void;
  onReady: () => void;
  timerRemaining: number | null;
  unavailableChampions: Set<string>;
  isLocking?: boolean;
  isReadyLoading?: boolean;
  iAmReady: boolean;
  isCaptain: boolean;
  hasSideSelected: boolean;
  onHeaderHeight?: (height: number) => void;
  fearlessChampions: DbLiveDraftUnavailableChampion[];
  // Draft data integration
  isLoggedIn: boolean;
  draftSessions: DraftSession[];
  linkedDraftSession: DraftSession | null;
  linkedDraftSessionId: string | null;
  onLinkDraftSession: (draftId: string | null) => void;
  contestedChampionIds: Set<string>;
  // Side picking (games 2+)
  onSelectSide?: (side: DraftSide) => void;
  onClearSide?: () => void;
  sidePickingLoading?: boolean;
  // Fill timed-out slot
  fillingSlot?: FillingSlot | null;
  onFillSlotClick?: (side: DraftSide, type: 'ban' | 'pick', index: number) => void;
  onFillConfirm?: () => void;
  onFillCancel?: () => void;
  isFillingLoading?: boolean;
}

export default function LiveDraftBoard({
  session,
  game,
  isMyTurn,
  mySide,
  selectedChampion,
  opponentHoveredChampion,
  onSelectChampion,
  onLockIn,
  onReady,
  timerRemaining,
  unavailableChampions,
  isLocking = false,
  isReadyLoading = false,
  iAmReady,
  isCaptain,
  hasSideSelected,
  onHeaderHeight,
  fearlessChampions,
  isLoggedIn,
  draftSessions,
  linkedDraftSession,
  linkedDraftSessionId,
  onLinkDraftSession,
  contestedChampionIds,
  onSelectSide,
  onClearSide,
  sidePickingLoading,
  fillingSlot = null,
  onFillSlotClick,
  onFillConfirm,
  onFillCancel,
  isFillingLoading = false,
}: LiveDraftBoardProps) {
  const headerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!onHeaderHeight || !headerRef.current) return;
    const el = headerRef.current;
    const observer = new ResizeObserver(() => {
      onHeaderHeight(el.offsetHeight);
    });
    onHeaderHeight(el.offsetHeight);
    observer.observe(el);
    return () => observer.disconnect();
  }, [onHeaderHeight]);
  // Get team info for each side
  // For completed/in-progress games, use the game's recorded blue_side_team.
  // Only fall back to the session-level side during side-picking (before game starts).
  const isTeam1Blue = game.status === 'pending' && game.game_number > 1
    ? session.team1_side === 'blue'
    : game.blue_side_team === 'team1';
  const blueTeam = {
    name: isTeam1Blue ? session.team1_name : session.team2_name,
    captainName: isTeam1Blue ? session.team1_captain_display_name : session.team2_captain_display_name,
    captainAvatarUrl: isTeam1Blue ? session.team1_captain_avatar_url : session.team2_captain_avatar_url,
    captainRole: isTeam1Blue ? session.team1_captain_role : session.team2_captain_role,
    captainRoleTeamName: isTeam1Blue ? session.team1_captain_role_team_name : session.team2_captain_role_team_name,
    isReady: isTeam1Blue ? !!session.team1_ready : !!session.team2_ready,
  };
  const redTeam = {
    name: isTeam1Blue ? session.team2_name : session.team1_name,
    captainName: isTeam1Blue ? session.team2_captain_display_name : session.team1_captain_display_name,
    captainAvatarUrl: isTeam1Blue ? session.team2_captain_avatar_url : session.team1_captain_avatar_url,
    captainRole: isTeam1Blue ? session.team2_captain_role : session.team1_captain_role,
    captainRoleTeamName: isTeam1Blue ? session.team2_captain_role_team_name : session.team1_captain_role_team_name,
    isReady: isTeam1Blue ? !!session.team2_ready : !!session.team1_ready,
  };

  // Current draft step info
  const currentStep = game.current_action_index >= 0 ? DRAFT_ORDER[game.current_action_index] : null;
  const currentActionType = currentStep?.actionType || null;

  const getSlotActive = (side: DraftSide, type: 'ban' | 'pick', index: number): boolean => {
    if (!currentStep || game.status !== 'drafting') return false;
    return currentStep.turn === side && currentStep.actionType === type && currentStep.index === index;
  };

  // Resolve hovered champion for a given side (my hover or opponent's)
  const getHoveredChampion = (side: DraftSide): string | null => {
    if (isMyTurn && mySide === side) return selectedChampion;
    if (!isMyTurn && mySide !== side) return opponentHoveredChampion;
    return null;
  };

  const canLockIn = isMyTurn && selectedChampion && !unavailableChampions.has(selectedChampion);
  const canFillConfirm = fillingSlot && selectedChampion && !unavailableChampions.has(selectedChampion);
  const isSessionCompleted = session.status === 'completed' || session.status === 'cancelled';
  const showReady = (session.status === 'lobby' || game.status === 'pending') && !isSessionCompleted;
  const isDraftFinished = game.status === 'completed' || isSessionCompleted;

  // Check if a pick slot can be filled (timed out + captain's own side)
  const canFillSlot = (side: DraftSide, type: 'ban' | 'pick', index: number): boolean => {
    if (!isCaptain || !mySide || mySide !== side) return false;
    // Only allow during drafting or after completion (not during lobby/pending)
    if (game.status !== 'drafting' && game.status !== 'completed') return false;
    const picks = type === 'pick'
      ? (side === 'blue' ? game.blue_picks : game.red_picks)
      : (side === 'blue' ? game.blue_bans : game.red_bans);
    return picks[index] === NONE_CHAMPION;
  };

  const isSlotFilling = (side: DraftSide, type: 'ban' | 'pick', index: number): boolean => {
    return !!fillingSlot && fillingSlot.side === side && fillingSlot.type === type && fillingSlot.index === index;
  };

  // Side picking mode: games 2+ when sides haven't been selected yet
  const isSidePicking = game.game_number > 1 && showReady;
  const isBlueSideTaken = session.team1_side === 'blue' || session.team2_side === 'blue';
  const isRedSideTaken = session.team1_side === 'red' || session.team2_side === 'red';

  return (
    <div className="flex flex-col h-full overflow-hidden max-w-[1900px] w-full mx-auto">
      {/* === TOP: VS Header with team cards === */}
      <div ref={headerRef}>
        <DraftHeader
          blueTeam={blueTeam}
          redTeam={redTeam}
          currentTurn={game.current_turn}
          timerRemaining={timerRemaining}
          showReadyState={showReady}
          isSidePicking={isSidePicking}
          isCaptain={isCaptain}
          mySide={mySide}
          onSelectSide={onSelectSide}
          onClearSide={onClearSide}
          sidePickingLoading={sidePickingLoading}
          isBlueSideTaken={isBlueSideTaken}
          isRedSideTaken={isRedSideTaken}
        />
      </div>

      {/* === BANS ROW === */}
      <div className="relative flex items-center justify-between gap-8 pt-2 pb-1 max-w-[1900px] w-full mx-auto">
        {/* Blue Bans */}
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((index) => (
            <DraftSlotLive
              key={`blue-ban-${index}`}
              type="ban"
              championId={game.blue_bans[index]}
              side="blue"
              variant="icon"
              isActive={getSlotActive('blue', 'ban', index)}
              hoveredChampionId={getHoveredChampion('blue')}
            />
          ))}
          <div className="w-1" />
          {[3, 4].map((index) => (
            <DraftSlotLive
              key={`blue-ban-${index}`}
              type="ban"
              championId={game.blue_bans[index]}
              side="blue"
              variant="icon"
              isActive={getSlotActive('blue', 'ban', index)}
              hoveredChampionId={getHoveredChampion('blue')}
            />
          ))}
          <span className="text-[10px] text-lol-border-light uppercase tracking-wider ml-1">Bans</span>
        </div>

        {/* Red Bans (mirrored) */}
        <div className="flex flex-row-reverse items-center gap-1.5">
          {[0, 1, 2].map((index) => (
            <DraftSlotLive
              key={`red-ban-${index}`}
              type="ban"
              championId={game.red_bans[index]}
              side="red"
              variant="icon"
              isActive={getSlotActive('red', 'ban', index)}
              hoveredChampionId={getHoveredChampion('red')}
            />
          ))}
          <div className="w-1" />
          {[3, 4].map((index) => (
            <DraftSlotLive
              key={`red-ban-${index}`}
              type="ban"
              championId={game.red_bans[index]}
              side="red"
              variant="icon"
              isActive={getSlotActive('red', 'ban', index)}
              hoveredChampionId={getHoveredChampion('red')}
            />
          ))}
          <span className="text-[10px] text-lol-border-light uppercase tracking-wider mr-1">Bans</span>
        </div>
      </div>

      {/* === FEARLESS BAR === */}
      <FearlessBar
        draftMode={session.draft_mode}
        fearlessChampions={fearlessChampions}
        currentGameNumber={game.game_number}
      />

      {/* === MIDDLE: Picks on sides, Champion Grid in center === */}
      <div className="flex-1 flex min-h-0">
        {/* Blue Picks - vertical stack */}
        <div className="flex-1 min-w-48 flex flex-col gap-0.5 pt-1 pr-1">
          {[0, 1, 2, 3, 4].map((index) => (
            <DraftSlotLive
              key={`blue-pick-${index}`}
              type="pick"
              championId={game.blue_picks[index]}
              side="blue"
              variant="bar"
              pickIndex={index}
              isActive={getSlotActive('blue', 'pick', index)}
              hoveredChampionId={getHoveredChampion('blue')}
              canFill={canFillSlot('blue', 'pick', index)}
              isFilling={isSlotFilling('blue', 'pick', index)}
              onFillClick={() => onFillSlotClick?.('blue', 'pick', index)}
            />
          ))}
        </div>

        {/* Champion Selection Grid + Action Button - center */}
        <div className="w-[700px] shrink-0 flex flex-col min-h-0">
          <div className="flex-1 min-h-0 overflow-hidden">
            <DraftChampionGrid
              unavailableChampions={unavailableChampions}
              selectedChampion={selectedChampion}
              onSelectChampion={onSelectChampion}
              isMyTurn={isMyTurn || !!fillingSlot}
              isBanPhase={fillingSlot ? fillingSlot.type === 'ban' : currentActionType === 'ban'}
              isLoggedIn={isLoggedIn}
              draftSessions={draftSessions}
              linkedDraftSession={linkedDraftSession}
              linkedDraftSessionId={linkedDraftSessionId}
              onLinkDraftSession={onLinkDraftSession}
              contestedChampionIds={contestedChampionIds}
            />
          </div>

          {/* Action Button - centered between grid and viewport bottom */}
          <div className="shrink-0 h-24 flex items-center justify-center px-4">
            {fillingSlot ? (
              <div className="flex items-center gap-3">
                <button
                  onClick={onFillCancel}
                  className="py-3 px-5 rounded-xl font-semibold text-base transition-all border-2 bg-lol-dark text-gray-400 border-lol-border hover:bg-lol-surface hover:text-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={onFillConfirm}
                  disabled={!canFillConfirm || isFillingLoading}
                  className={`
                    min-w-[200px] py-3 px-6 rounded-xl font-semibold text-base transition-all border-2
                    ${canFillConfirm && !isFillingLoading
                      ? 'bg-lol-dark text-white border-lol-border-light hover:bg-lol-surface'
                      : 'bg-lol-dark text-gray-600 border-lol-border'
                    }
                    disabled:opacity-40 disabled:cursor-not-allowed
                  `}
                >
                  {isFillingLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Filling...
                    </span>
                  ) : (
                    `Fill ${fillingSlot.type}`
                  )}
                </button>
              </div>
            ) : showReady ? (
              <button
                onClick={onReady}
                disabled={!isCaptain || !hasSideSelected || isReadyLoading}
                className={`
                  min-w-[200px] py-3 px-6 rounded-xl font-semibold text-base transition-all
                  ${iAmReady
                    ? 'bg-green-600/20 text-green-400 border-2 border-green-500/50 hover:bg-green-600/30'
                    : isCaptain && hasSideSelected
                      ? 'bg-lol-surface text-gray-100 border-2 border-lol-border hover:bg-lol-card-hover hover:border-lol-border-light hover:text-white'
                      : 'bg-lol-dark text-gray-600 border-2 border-lol-border cursor-not-allowed'
                  }
                  disabled:opacity-40 disabled:cursor-not-allowed
                `}
              >
                {isReadyLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    {iAmReady ? 'Unreadying...' : 'Readying...'}
                  </span>
                ) : iAmReady ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Ready
                  </span>
                ) : isSidePicking && !hasSideSelected ? (
                  'Pick Side'
                ) : (
                  'Ready up'
                )}
              </button>
            ) : isDraftFinished ? (
              <button
                disabled
                className="min-w-[200px] py-3 px-6 rounded-xl font-semibold text-base bg-lol-dark text-gray-500 border-2 border-lol-border"
              >
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Finished
                </span>
              </button>
            ) : (
              <button
                onClick={onLockIn}
                disabled={!canLockIn || isLocking}
                className={`
                  min-w-[200px] py-3 px-6 rounded-xl font-semibold text-base transition-all border-2
                  ${canLockIn && !isLocking
                    ? 'bg-lol-dark text-white border-lol-border-light hover:bg-lol-surface'
                    : 'bg-lol-dark text-gray-600 border-lol-border'
                  }
                  disabled:opacity-40 disabled:cursor-not-allowed
                `}
              >
                {isLocking ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Locking...
                  </span>
                ) : currentActionType === 'ban' ? (
                  selectedChampion === NONE_CHAMPION ? 'No ban' : 'Ban champion'
                ) : (
                  'Lock in'
                )}
              </button>
            )}
          </div>
        </div>

        {/* Red Picks - vertical stack */}
        <div className="flex-1 min-w-48 flex flex-col gap-0.5 pt-1 pl-1">
          {[0, 1, 2, 3, 4].map((index) => (
            <DraftSlotLive
              key={`red-pick-${index}`}
              type="pick"
              championId={game.red_picks[index]}
              side="red"
              variant="bar"
              pickIndex={index}
              isActive={getSlotActive('red', 'pick', index)}
              hoveredChampionId={getHoveredChampion('red')}
              canFill={canFillSlot('red', 'pick', index)}
              isFilling={isSlotFilling('red', 'pick', index)}
              onFillClick={() => onFillSlotClick?.('red', 'pick', index)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
