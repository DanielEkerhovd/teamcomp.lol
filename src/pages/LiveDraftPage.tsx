import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { liveDraftService } from '../lib/liveDraftService';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/useAuthStore';
import { Button } from '../components/ui';
import LiveDraftLobbyModal from '../components/live-draft/LiveDraftLobbyModal';
import LiveDraftChat from '../components/live-draft/LiveDraftChat';
import LiveDraftBoard from '../components/live-draft/LiveDraftBoard';
import { DRAFT_ORDER } from '../types/liveDraft';
import type {
  LiveDraftSession,
  LiveDraftParticipant,
  LiveDraftGame,
  LiveDraftMessage,
  DraftSide,
} from '../types/liveDraft';

// Empty game placeholder used before the draft starts
const EMPTY_GAME: LiveDraftGame = {
  id: '',
  session_id: '',
  game_number: 1,
  blue_side_team: 'team1',
  status: 'pending',
  current_phase: null,
  current_turn: null,
  current_action_index: -1,
  turn_started_at: null,
  blue_bans: [null, null, null, null, null],
  red_bans: [null, null, null, null, null],
  blue_picks: [null, null, null, null, null],
  red_picks: [null, null, null, null, null],
  edited_picks: [],
  winner: null,
  started_at: null,
  completed_at: null,
  created_at: '',
  updated_at: '',
};

// Soft chime sound for when both teams are ready
const READY_SOUND_URL = '/sounds/ready.mp3';

export default function LiveDraftPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { user: authUser, profile: authProfile } = useAuthStore();

  const [session, setSession] = useState<LiveDraftSession | null>(null);
  const [participants, setParticipants] = useState<LiveDraftParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [myDisplayName, setMyDisplayName] = useState<string | null>(null);
  const [defaultDisplayName, setDefaultDisplayName] = useState<string>('');

  // Lobby modal state
  const [showLobbyModal, setShowLobbyModal] = useState(true);

  // Ready state
  const [bothTeamsWereReady, setBothTeamsWereReady] = useState(false);

  // Sound ref
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Chat state
  const [messages, setMessages] = useState<LiveDraftMessage[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [lastSeenMessageCount, setLastSeenMessageCount] = useState(0);
  const [boardHeaderHeight, setBoardHeaderHeight] = useState(0);

  // Game/Draft state
  const [allGames, setAllGames] = useState<LiveDraftGame[]>([]);
  const [viewedGameNumber, setViewedGameNumber] = useState<number | null>(null);
  const [selectedChampion, setSelectedChampion] = useState<string | null>(null);
  const [timerRemaining, setTimerRemaining] = useState<number | null>(null);
  const [isLocking, setIsLocking] = useState(false);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Derived game state
  const activeGame = useMemo(() => {
    return allGames.find(g => g.status === 'drafting') ?? null;
  }, [allGames]);

  const viewedGame = useMemo(() => {
    if (viewedGameNumber !== null) {
      return allGames.find(g => g.game_number === viewedGameNumber) ?? null;
    }
    return activeGame ?? allGames[allGames.length - 1] ?? null;
  }, [allGames, viewedGameNumber, activeGame]);

  const isViewingActiveGame = viewedGame?.id === activeGame?.id && activeGame !== null;

  const loadSession = useCallback(async () => {
    if (!sessionId) return;

    try {
      const [sessionData, participantsData, messagesData] = await Promise.all([
        liveDraftService.getSession(sessionId),
        liveDraftService.getParticipants(sessionId),
        liveDraftService.getMessages(sessionId),
      ]);

      if (!sessionData) {
        setError('Session not found');
        return;
      }

      setSession(sessionData);
      setParticipants(participantsData);
      setMessages(messagesData);

      // Load all games if session is in progress
      if (sessionData.status === 'in_progress') {
        const games = await liveDraftService.getGames(sessionId);
        setAllGames(games);
      }
    } catch (err) {
      console.error('Failed to load session:', err);
      setError(err instanceof Error ? err.message : 'Failed to load session');
    }
  }, [sessionId]);

  // Sync auth store user into local state (no network calls)
  useEffect(() => {
    setCurrentUserId(authUser?.id ?? null);
    setDefaultDisplayName(authProfile?.displayName || '');
  }, [authUser, authProfile]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      setError(null);

      const isLoggedIn = !!authUser;

      // Restore anonymous user's display name from localStorage
      if (!isLoggedIn && sessionId) {
        try {
          const savedDisplayName = localStorage.getItem(`live_draft_display_name_${sessionId}`);
          if (savedDisplayName) {
            setMyDisplayName(savedDisplayName);
          }
        } catch {
          // Ignore localStorage errors
        }
      }

      await loadSession();
      setLoading(false);
    };

    if (sessionId) {
      init();
    }
  }, [sessionId, loadSession, authUser]);

  // Set up realtime subscription
  useEffect(() => {
    if (!sessionId || !supabase) return;

    const channel = supabase
      .channel(`live_draft_${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_draft_sessions',
          filter: `id=eq.${sessionId}`,
        },
        () => {
          loadSession();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_draft_participants',
          filter: `session_id=eq.${sessionId}`,
        },
        () => {
          loadSession();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_draft_games',
          filter: `session_id=eq.${sessionId}`,
        },
        async () => {
          // Reload all game data when any game changes
          const games = await liveDraftService.getGames(sessionId);
          setAllGames(games);
          setSelectedChampion(null);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'live_draft_messages',
          filter: `session_id=eq.${sessionId}`,
        },
        async () => {
          // Reload messages when a new message is inserted
          const newMessages = await liveDraftService.getMessages(sessionId);
          setMessages(newMessages);
        }
      )
      .subscribe();

    return () => {
      if (supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, [sessionId, loadSession]);

  // Check for both teams ready and play sound + auto-start
  useEffect(() => {
    if (!session) return;

    const hasTeam1Captain = !!(session.team1_captain_id || session.team1_captain_display_name);
    const hasTeam2Captain = !!(session.team2_captain_id || session.team2_captain_display_name);
    const bothReady =
      hasTeam1Captain &&
      hasTeam2Captain &&
      session.team1_side &&
      session.team2_side &&
      session.team1_ready &&
      session.team2_ready;

    if (bothReady && !bothTeamsWereReady) {
      // Play soft sound
      if (audioRef.current) {
        audioRef.current.volume = 0.15;
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {
          // Autoplay may be blocked, ignore
        });
      }
      setBothTeamsWereReady(true);

      // Auto-start the draft after a brief delay
      if (session.status === 'lobby') {
        const autoStartTimer = setTimeout(async () => {
          try {
            await liveDraftService.startSession(session.id);
            await loadSession();
          } catch (err) {
            console.error('Auto-start failed:', err);
          }
        }, 1500);

        return () => clearTimeout(autoStartTimer);
      }
    } else if (!bothReady) {
      setBothTeamsWereReady(false);
    }
  }, [session, bothTeamsWereReady, loadSession]);

  // Timer countdown effect — always based on activeGame
  useEffect(() => {
    if (!activeGame || activeGame.status !== 'drafting' || !activeGame.turn_started_at || !session) {
      setTimerRemaining(null);
      return;
    }

    const currentStep = DRAFT_ORDER[activeGame.current_action_index];
    const timeLimit = currentStep?.actionType === 'ban' ? session.ban_time_seconds : session.pick_time_seconds;
    const turnStart = new Date(activeGame.turn_started_at).getTime();

    const updateTimer = () => {
      const elapsed = Math.floor((Date.now() - turnStart) / 1000);
      const remaining = Math.max(0, timeLimit - elapsed);
      setTimerRemaining(remaining);
    };

    updateTimer();
    timerIntervalRef.current = setInterval(updateTimer, 1000);

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [activeGame, session]);

  // Keep seen count in sync while chat is open
  useEffect(() => {
    if (chatOpen) {
      setLastSeenMessageCount(messages.length);
    }
  }, [chatOpen, messages.length]);

  // Determine user's role
  // For anonymous users, also check localStorage directly in case state hasn't updated
  const storedDisplayName = !currentUserId && sessionId
    ? (() => {
        try {
          return localStorage.getItem(`live_draft_display_name_${sessionId}`);
        } catch {
          return null;
        }
      })()
    : null;
  const effectiveDisplayName = myDisplayName || storedDisplayName;

  const isTeam1Captain = currentUserId
    ? session?.team1_captain_id === currentUserId
    : effectiveDisplayName
      ? session?.team1_captain_display_name === effectiveDisplayName
      : false;
  const isTeam2Captain = currentUserId
    ? session?.team2_captain_id === currentUserId
    : effectiveDisplayName
      ? session?.team2_captain_display_name === effectiveDisplayName
      : false;
  const isCaptain = isTeam1Captain || isTeam2Captain;

  const myTeam = isTeam1Captain ? 'team1' : isTeam2Captain ? 'team2' : null;
  const mySide = myTeam === 'team1' ? session?.team1_side : myTeam === 'team2' ? session?.team2_side : null;
  // Check if it's my turn in the draft (only when viewing the active game)
  const isMyTurn = useMemo(() => {
    if (!isViewingActiveGame || !activeGame || !mySide || activeGame.status !== 'drafting') return false;
    return activeGame.current_turn === mySide;
  }, [isViewingActiveGame, activeGame, mySide]);

  // Compute unavailable champions based on viewed game
  const unavailableChampions = useMemo(() => {
    const unavailable = new Set<string>();
    if (!viewedGame) return unavailable;

    // Add all picked and banned champions from viewed game
    [...viewedGame.blue_bans, ...viewedGame.red_bans, ...viewedGame.blue_picks, ...viewedGame.red_picks]
      .filter((id): id is string => id !== null)
      .forEach(id => unavailable.add(id));

    return unavailable;
  }, [viewedGame]);

  // Handle game selection from header squares
  const handleGameSelect = useCallback(async (gameNumber: number) => {
    const existingGame = allGames.find(g => g.game_number === gameNumber);

    if (existingGame) {
      if (existingGame.status === 'drafting') {
        setViewedGameNumber(null); // Follow active game
      } else {
        setViewedGameNumber(gameNumber);
      }
      return;
    }

    // Game doesn't exist — create it (captains only)
    if (!isCaptain || !session) return;

    const previousGame = allGames.find(g => g.game_number === gameNumber - 1);
    if (!previousGame || previousGame.status !== 'completed') return;

    try {
      const newGame = await liveDraftService.createGame(session.id, gameNumber);
      await liveDraftService.startGame(newGame.id);
      setViewedGameNumber(null); // Follow the new active game
    } catch (err) {
      console.error('Failed to start next game:', err);
      setError(err instanceof Error ? err.message : 'Failed to start next game');
    }
  }, [allGames, isCaptain, session]);

  // Handle ready toggle
  const [readyLoading, setReadyLoading] = useState(false);

  const iAmReady = useMemo(() => {
    if (!session || !myTeam) return false;
    return myTeam === 'team1' ? !!session.team1_ready : !!session.team2_ready;
  }, [session, myTeam]);

  const handleReady = async () => {
    if (!session || !myTeam || readyLoading) return;

    setReadyLoading(true);
    setError(null);

    // For anonymous users, determine team from display name
    const teamParam = currentUserId ? undefined : myTeam;

    try {
      await liveDraftService.setReady(session.id, !iAmReady, teamParam);
      await loadSession();
    } catch (err) {
      console.error('Failed to toggle ready:', err);
      setError(err instanceof Error ? err.message : 'Failed to toggle ready');
    } finally {
      setReadyLoading(false);
    }
  };

  // Handle lock in
  const handleLockIn = async () => {
    if (!activeGame || !selectedChampion || !isMyTurn || isLocking) return;

    setIsLocking(true);
    setError(null);

    try {
      await liveDraftService.submitAction(activeGame.id, selectedChampion);
      setSelectedChampion(null);
    } catch (err) {
      console.error('Failed to lock in:', err);
      setError(err instanceof Error ? err.message : 'Failed to lock in champion');
    } finally {
      setIsLocking(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex items-center gap-3 text-gray-400">
          <svg className="animate-spin h-6 w-6" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Loading session...
        </div>
      </div>
    );
  }

  if (error && !session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="text-red-400 text-lg">{error}</div>
        <Button variant="secondary" onClick={() => navigate('/live-draft')}>
          Back to Sessions
        </Button>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="space-y-2 -mt-4">
      {/* Audio element for ready sound */}
      <audio ref={audioRef} src={READY_SOUND_URL} preload="auto" />

      {/* Header with team info - full width */}
      <div className="relative flex items-center justify-between py-1">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-white">{session.name}</h1>
          <span className="text-gray-500 text-xs">
            {session.draft_mode === 'normal' ? 'Normal' : session.draft_mode === 'fearless' ? 'Fearless' : 'Ironman'}
          </span>

          {/* Game navigation squares */}
          <div className="flex items-center gap-1 ml-1">
            {Array.from({ length: session.planned_games }, (_, i) => i + 1).map(gNum => {
              const game = allGames.find(g => g.game_number === gNum);
              const isCompleted = game?.status === 'completed';
              const isDrafting = game?.status === 'drafting';
              const isViewed = gNum === (viewedGame?.game_number ?? 1);

              const previousGame = gNum === 1 ? null : allGames.find(g => g.game_number === gNum - 1);
              const isNextAvailable = !game && (gNum === 1 || previousGame?.status === 'completed');

              const isClickable = isCompleted || isDrafting || (isNextAvailable && isCaptain);

              return (
                <button
                  key={gNum}
                  onClick={() => isClickable && handleGameSelect(gNum)}
                  disabled={!isClickable}
                  className={`
                    w-9 h-6 rounded text-[11px] font-medium transition-all border
                    ${isViewed
                      ? 'border-lol-border-light text-white bg-lol-surface'
                      : isCompleted
                        ? 'border-lol-border text-gray-400 bg-lol-card hover:bg-lol-card-hover hover:text-gray-300 cursor-pointer'
                        : isDrafting
                          ? 'border-lol-border-light text-gray-300 bg-lol-card-hover'
                          : isNextAvailable && isCaptain
                            ? 'border-lol-border text-gray-500 bg-lol-dark hover:bg-lol-card hover:text-gray-400 cursor-pointer'
                            : 'border-lol-border/50 text-gray-700 bg-lol-dark/60 cursor-not-allowed'
                    }
                  `}
                  title={
                    isDrafting ? `Game ${gNum} (Live)`
                    : isCompleted ? `Game ${gNum} (Completed)`
                    : isNextAvailable && isCaptain ? `Start Game ${gNum}`
                    : `Game ${gNum}`
                  }
                >
                  G{gNum}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setChatOpen(!chatOpen);
              if (!chatOpen) setLastSeenMessageCount(messages.length);
            }}
            className="relative"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {!chatOpen && messages.length > lastSeenMessageCount && (
              <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-xs font-bold text-white bg-red-500 rounded-full">
                {messages.length - lastSeenMessageCount > 9 ? '9+' : messages.length - lastSeenMessageCount}
              </span>
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (audioRef.current) {
                audioRef.current.volume = 0.15;
                audioRef.current.currentTime = 0;
                audioRef.current.play().catch(() => {});
              }
            }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowLobbyModal(true)}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </Button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm text-center">
          {error}
        </div>
      )}

      {/* Board + Chat sidebar */}
      <div className={`flex h-[calc(100vh-120px)] min-h-175 transition-all duration-200 ${chatOpen ? '-mr-8' : ''}`}>
        <div className="flex-1 min-w-0">
          <LiveDraftBoard
            session={session}
            game={viewedGame ?? EMPTY_GAME}
            isMyTurn={isMyTurn}
            mySide={mySide ?? null}
            selectedChampion={isViewingActiveGame ? selectedChampion : null}
            onSelectChampion={setSelectedChampion}
            onLockIn={handleLockIn}
            onReady={handleReady}
            timerRemaining={isViewingActiveGame ? timerRemaining : null}
            unavailableChampions={unavailableChampions}
            isLocking={isLocking}
            isReadyLoading={readyLoading}
            iAmReady={iAmReady}
            isCaptain={isCaptain}
            hasSideSelected={!!mySide}
            onHeaderHeight={setBoardHeaderHeight}
          />
        </div>

        {/* Chat sidebar - aligned with board */}
        <div className={`shrink-0 transition-all duration-200 overflow-hidden ${chatOpen ? 'w-72' : 'w-0'}`}>
          <div className="w-72 h-full">
            <LiveDraftChat
              sessionId={session.id}
              messages={messages}
              isCaptain={isCaptain}
              currentUserDisplayName={effectiveDisplayName || defaultDisplayName || null}
              onClose={() => setChatOpen(false)}
              headerHeight={boardHeaderHeight}
            />
          </div>
        </div>
      </div>

      {/* Lobby Modal */}
      <LiveDraftLobbyModal
        isOpen={showLobbyModal}
        onClose={() => setShowLobbyModal(false)}
        session={session}
        participants={participants}
        currentUserId={currentUserId}
        myDisplayName={myDisplayName}
        setMyDisplayName={setMyDisplayName}
        defaultDisplayName={defaultDisplayName}
        loadSession={loadSession}
        setError={setError}
      />
    </div>
  );
}

