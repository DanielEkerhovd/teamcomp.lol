import { useRef, useEffect } from 'react';
import DraftSlotLive from './DraftSlotLive';
import DraftHeader from './DraftHeader';
import DraftChampionGrid from './DraftChampionGrid';
import type { LiveDraftSession, LiveDraftGame, DraftSide } from '../../types/liveDraft';
import { DRAFT_ORDER } from '../../types/liveDraft';

interface LiveDraftBoardProps {
  session: LiveDraftSession;
  game: LiveDraftGame;
  isMyTurn: boolean;
  mySide: DraftSide | null;
  selectedChampion: string | null;
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
}

// TEST DATA: random champion splash arts for red side
const TEST_RED_PICKS: (string | null)[] = ['Ahri', 'Darius', 'Jinx', 'Thresh', 'Yasuo'];

export default function LiveDraftBoard({
  session,
  game,
  isMyTurn,
  mySide,
  selectedChampion,
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
  // Override red picks with test data
  const redPicks = TEST_RED_PICKS;
  // Get team info for each side
  const isTeam1Blue = session.team1_side === 'blue';
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
    if (!currentStep) return false;
    return currentStep.turn === side && currentStep.actionType === type && currentStep.index === index;
  };

  const canLockIn = isMyTurn && selectedChampion && !unavailableChampions.has(selectedChampion);
  const showReady = session.status === 'lobby' || game.status === 'pending';

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* === TOP: VS Header with team cards === */}
      <div ref={headerRef}>
        <DraftHeader
          blueTeam={blueTeam}
          redTeam={redTeam}
          currentTurn={game.current_turn}
          timerRemaining={timerRemaining}
          showReadyState={showReady}
        />
      </div>

      {/* === BANS ROW === */}
      <div className="relative flex items-center justify-between gap-8 pt-2 pb-1">
        {/* Centered game indicator */}
        <span className="absolute left-1/2 -translate-x-1/2 text-gray-500 text-xs pointer-events-none">
          Game {game.game_number} of {session.planned_games}
        </span>

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
              hoveredChampionId={isMyTurn && mySide === 'blue' ? selectedChampion : null}
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
              hoveredChampionId={isMyTurn && mySide === 'blue' ? selectedChampion : null}
            />
          ))}
          <span className="text-[10px] text-lol-border-light uppercase tracking-wider ml-1">Bans</span>
        </div>

        {/* Red Bans (mirrored) */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-lol-border-light uppercase tracking-wider mr-1">Bans</span>
          {[3, 4].map((index) => (
            <DraftSlotLive
              key={`red-ban-${index}`}
              type="ban"
              championId={game.red_bans[index]}
              side="red"
              variant="icon"
              isActive={getSlotActive('red', 'ban', index)}
              hoveredChampionId={isMyTurn && mySide === 'red' ? selectedChampion : null}
            />
          ))}
          <div className="w-1" />
          {[0, 1, 2].map((index) => (
            <DraftSlotLive
              key={`red-ban-${index}`}
              type="ban"
              championId={game.red_bans[index]}
              side="red"
              variant="icon"
              isActive={getSlotActive('red', 'ban', index)}
              hoveredChampionId={isMyTurn && mySide === 'red' ? selectedChampion : null}
            />
          ))}
        </div>
      </div>

      {/* === MIDDLE: Picks on sides, Champion Grid in center === */}
      <div className="flex-1 flex min-h-0">
        {/* Blue Picks - vertical stack */}
        <div className="flex-1 min-w-48 flex flex-col gap-0.5 py-1 pr-1">
          {[0, 1, 2, 3, 4].map((index) => (
            <DraftSlotLive
              key={`blue-pick-${index}`}
              type="pick"
              championId={game.blue_picks[index]}
              side="blue"
              variant="bar"
              pickIndex={index}
              isActive={getSlotActive('blue', 'pick', index)}
              hoveredChampionId={isMyTurn && mySide === 'blue' ? selectedChampion : null}
            />
          ))}
        </div>

        {/* Champion Selection Grid + Action Button - center */}
        <div className="w-[700px] shrink-0 flex flex-col min-h-0 py-1">
          <div className="flex-1 min-h-0 overflow-hidden">
            <DraftChampionGrid
              unavailableChampions={unavailableChampions}
              selectedChampion={selectedChampion}
              onSelectChampion={onSelectChampion}
              isMyTurn={isMyTurn}
            />
          </div>

          {/* Action Button */}
          <div className="shrink-0 flex items-center justify-center px-4 py-3">
            {showReady ? (
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
                ) : (
                  'Ready up'
                )}
              </button>
            ) : (
              <button
                onClick={onLockIn}
                disabled={!canLockIn || isLocking}
                className={`
                  min-w-[200px] py-3 px-6 rounded-xl font-semibold text-base transition-all
                  ${canLockIn && !isLocking
                    ? currentActionType === 'ban'
                      ? 'bg-orange-600 text-white border-2 border-orange-500 hover:bg-orange-700'
                      : 'bg-lol-surface text-gray-100 border-2 border-lol-border hover:bg-lol-card-hover hover:border-lol-border-light hover:text-white'
                    : 'bg-lol-dark text-gray-600 border-2 border-lol-border'
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
                  'Ban champion'
                ) : (
                  'Lock in'
                )}
              </button>
            )}
          </div>
        </div>

        {/* Red Picks - vertical stack (TEST: hardcoded champions) */}
        <div className="flex-1 min-w-48 flex flex-col gap-0.5 py-1 pl-1">
          {[0, 1, 2, 3, 4].map((index) => (
            <DraftSlotLive
              key={`red-pick-${index}`}
              type="pick"
              championId={redPicks[index]}
              side="red"
              variant="bar"
              pickIndex={index}
              isActive={getSlotActive('red', 'pick', index)}
              hoveredChampionId={isMyTurn && mySide === 'red' ? selectedChampion : null}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
