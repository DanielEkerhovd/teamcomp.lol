import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { liveDraftService } from '../lib/liveDraftService';
import { useChampionData } from '../hooks/useChampionData';
import { preloadAllSplashes } from '../lib/datadragon';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/useAuthStore';
import { useDraftStore } from '../stores/useDraftStore';
import { useMyTeamStore } from '../stores/useMyTeamStore';
import { useEnemyTeamStore } from '../stores/useEnemyTeamStore';
import { usePlayerPoolStore } from '../stores/usePlayerPoolStore';
import { useCustomPoolStore } from '../stores/useCustomPoolStore';
import { useDraftAnalytics } from '../components/draft/hooks/useDraftAnalytics';
import { Button } from '../components/ui';
import LiveDraftLobbyModal from '../components/live-draft/LiveDraftLobbyModal';
import LiveDraftChat from '../components/live-draft/LiveDraftChat';
import LiveDraftBoard from '../components/live-draft/LiveDraftBoard';
import type { FillingSlot } from '../components/live-draft/LiveDraftBoard';
import SpectatorCount from '../components/live-draft/SpectatorCount';
import { DRAFT_ORDER, NONE_CHAMPION } from '../types/liveDraft';
import type {
  LiveDraftSession,
  LiveDraftParticipant,
  LiveDraftGame,
  LiveDraftMessage,
  DbLiveDraftUnavailableChampion,
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
  const { champions } = useChampionData();

  // Preload all champion splash art into browser cache when entering the draft
  useEffect(() => {
    if (champions.length > 0) {
      preloadAllSplashes(champions);
    }
  }, [champions]);

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

  // Realtime channel ref (for broadcasting session updates)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const channelRef = useRef<any>(null);

  // Chat state
  const [messages, setMessages] = useState<LiveDraftMessage[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [lastSeenMessageId, setLastSeenMessageId] = useState<string | null>(() => {
    if (!sessionId) return null;
    try {
      return localStorage.getItem(`live_draft_chat_seen_${sessionId}`);
    } catch {
      return null;
    }
  });
  const [boardHeaderHeight, setBoardHeaderHeight] = useState(0);

  // Game/Draft state
  const [fearlessChampions, setFearlessChampions] = useState<DbLiveDraftUnavailableChampion[]>([]);
  const [allGames, setAllGames] = useState<LiveDraftGame[]>([]);
  const [viewedGameNumber, setViewedGameNumber] = useState<number | null>(null);
  const [selectedChampion, setSelectedChampion] = useState<string | null>(null);
  const [opponentHoveredChampion, setOpponentHoveredChampion] = useState<string | null>(null);
  const [timerRemaining, setTimerRemaining] = useState<number | null>(null);
  const [isLocking, setIsLocking] = useState(false);
  const lockingRef = useRef(false); // synchronous flag visible to both timer and click handler
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSubmittedIndexRef = useRef<number>(-999); // tracks which action_index we already auto-submitted for

  // Fill timed-out slot state
  const [fillingSlot, setFillingSlot] = useState<FillingSlot | null>(null);
  const [isFillingLoading, setIsFillingLoading] = useState(false);

  // Linked draft session state (for bans/priorities/contests)
  const [linkedDraftSessionId, setLinkedDraftSessionId] = useState<string | null>(() => {
    if (!sessionId) return null;
    try {
      return localStorage.getItem(`live_draft_linked_session_${sessionId}`);
    } catch {
      return null;
    }
  });

  // Draft data stores
  const draftSessions = useDraftStore((s) => s.sessions);
  const myTeams = useMyTeamStore((s) => s.teams);
  const enemyTeams = useEnemyTeamStore((s) => s.teams);
  const playerPools = usePlayerPoolStore((s) => s.pools);
  const customPools = useCustomPoolStore((s) => s.pools);

  // Resolve linked draft session
  const linkedDraftSession = useMemo(() => {
    if (!linkedDraftSessionId) return null;
    return draftSessions.find((s) => s.id === linkedDraftSessionId) ?? null;
  }, [linkedDraftSessionId, draftSessions]);

  // Resolve teams from linked draft session
  const linkedMyTeam = useMemo(() => {
    if (!linkedDraftSession?.myTeamId) return null;
    return myTeams.find((t) => t.id === linkedDraftSession.myTeamId) ?? null;
  }, [linkedDraftSession, myTeams]);

  const linkedEnemyTeam = useMemo(() => {
    if (!linkedDraftSession?.enemyTeamId) return null;
    return enemyTeams.find((t) => t.id === linkedDraftSession.enemyTeamId) ?? null;
  }, [linkedDraftSession, enemyTeams]);

  // Compute analytics for contested champions
  const draftAnalytics = useDraftAnalytics({
    myTeam: linkedMyTeam,
    enemyTeam: linkedEnemyTeam,
    customPools,
    selectedCustomPoolIds: [],
    tierFilter: ['S', 'A', 'B', 'C'],
    playerPools,
  });

  const contestedChampionIds = useMemo(() => {
    return new Set(draftAnalytics.contested.map((c) => c.championId));
  }, [draftAnalytics.contested]);

  // Save linked draft session to localStorage
  const handleLinkDraftSession = useCallback((draftId: string | null) => {
    setLinkedDraftSessionId(draftId);
    if (sessionId) {
      try {
        if (draftId) {
          localStorage.setItem(`live_draft_linked_session_${sessionId}`, draftId);
        } else {
          localStorage.removeItem(`live_draft_linked_session_${sessionId}`);
        }
      } catch {
        // Ignore localStorage errors
      }
    }
  }, [sessionId]);

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
        navigate('/live-draft');
        return;
      }

      setSession(sessionData);
      setParticipants(participantsData);
      setMessages(messagesData);

      // Load all games if session has started (in progress or completed)
      if (sessionData.status === 'in_progress' || sessionData.status === 'completed') {
        const games = await liveDraftService.getGames(sessionId);
        setAllGames(games);

        // Load fearless/ironman unavailable champions
        if (sessionData.draft_mode !== 'normal') {
          const uc = await liveDraftService.getUnavailableChampions(sessionId);
          setFearlessChampions(uc);
        }
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

  // Link anonymous participant to authenticated user after login
  const hasLinkedRef = useRef(false);
  useEffect(() => {
    if (!authUser || !sessionId || hasLinkedRef.current) return;

    const storedParticipantId = (() => {
      try { return localStorage.getItem(`live_draft_participant_${sessionId}`); } catch { return null; }
    })();
    const storedDisplayName = (() => {
      try { return localStorage.getItem(`live_draft_display_name_${sessionId}`); } catch { return null; }
    })();

    if (!storedParticipantId || !storedDisplayName) return;

    hasLinkedRef.current = true;

    liveDraftService.linkAnonymousParticipant(sessionId, storedParticipantId, authUser.id)
      .then(async (success) => {
        if (success) {
          // Wait for session to refresh so captain IDs are correct BEFORE
          // removing the localStorage guard that protects against kick detection.
          await loadSession();
        }
        // Clean up anonymous localStorage keys after session data is current.
        try {
          localStorage.removeItem(`live_draft_participant_${sessionId}`);
          localStorage.removeItem(`live_draft_display_name_${sessionId}`);
        } catch { /* ignore */ }
      })
      .catch((err) => {
        console.warn('Failed to link anonymous participant:', err);
        // Clean up on error so kick detection can resume
        try {
          localStorage.removeItem(`live_draft_participant_${sessionId}`);
          localStorage.removeItem(`live_draft_display_name_${sessionId}`);
        } catch { /* ignore */ }
      });
  }, [authUser, sessionId, loadSession]);

  // Restore anonymous user's display name from localStorage
  useEffect(() => {
    if (!authUser && sessionId) {
      try {
        const savedDisplayName = localStorage.getItem(`live_draft_display_name_${sessionId}`);
        if (savedDisplayName) {
          setMyDisplayName(savedDisplayName);
        }
      } catch {
        // Ignore localStorage errors
      }
    }
  }, [authUser, sessionId]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      setError(null);
      await loadSession();
      setLoading(false);
    };

    if (sessionId) {
      init();
    }
  }, [sessionId, loadSession]);

  // Set up realtime subscription
  useEffect(() => {
    if (!sessionId || !supabase) return;

    const channel = supabase
      .channel(`live_draft_${sessionId}`)
      .on(
        'broadcast',
        { event: 'session_updated' },
        () => {
          loadSession();
        }
      )
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
        'broadcast',
        { event: 'champion_hovered' },
        (payload: { payload: { championId: string | null; side: string } }) => {
          const { championId, side } = payload.payload;
          // Only show opponent hover (ignore own broadcasts)
          if (side !== mySideRef.current) {
            setOpponentHoveredChampion(championId);
          }
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
          setOpponentHoveredChampion(null);
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
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'live_draft_unavailable_champions',
          filter: `session_id=eq.${sessionId}`,
        },
        async () => {
          const uc = await liveDraftService.getUnavailableChampions(sessionId);
          setFearlessChampions(uc);
        }
      )
      .subscribe((status, err) => {
        if (err) {
          console.error('[LiveDraft] Realtime subscription error:', status, err);
        }
      });

    channelRef.current = channel;

    return () => {
      channelRef.current = null;
      if (supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, [sessionId, loadSession]);

  // Broadcast a session update to all subscribers via Supabase Broadcast
  const broadcastSessionUpdate = useCallback(() => {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'session_updated',
      payload: {},
    });
  }, []);

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
      // Use a ref so the timer survives the re-render caused by setBothTeamsWereReady
      if (autoStartTimerRef.current) clearTimeout(autoStartTimerRef.current);
      autoStartTimerRef.current = setTimeout(async () => {
        autoStartTimerRef.current = null;
        try {
          if (session.status === 'lobby') {
            // First game: start the whole session
            await liveDraftService.startSession(session.id);
          } else {
            // Subsequent games: find the pending game, set correct side, then start it
            const pendingGame = allGames.find(g => g.status === 'pending');
            if (pendingGame) {
              // Set blue_side_team based on current side selections (same logic as startSession)
              const blueSideTeam: 'team1' | 'team2' = session.team1_side === 'blue' ? 'team1' : 'team2';
              await liveDraftService.selectSide(pendingGame.id, blueSideTeam);
              await liveDraftService.startGame(pendingGame.id);
            }
          }
          broadcastSessionUpdate();
          await loadSession();
        } catch (err) {
          console.error('Auto-start failed:', err);
        }
      }, 1500);
    } else if (!bothReady) {
      setBothTeamsWereReady(false);
      if (autoStartTimerRef.current) {
        clearTimeout(autoStartTimerRef.current);
        autoStartTimerRef.current = null;
      }
    }
  }, [session, bothTeamsWereReady, allGames, broadcastSessionUpdate, loadSession]);

  // Clean up auto-start timer on unmount
  useEffect(() => {
    return () => {
      if (autoStartTimerRef.current) clearTimeout(autoStartTimerRef.current);
    };
  }, []);

  // Persist last seen message when chat is open
  useEffect(() => {
    if (chatOpen && messages.length > 0 && sessionId) {
      const lastId = messages[messages.length - 1].id;
      setLastSeenMessageId(lastId);
      try {
        localStorage.setItem(`live_draft_chat_seen_${sessionId}`, lastId);
      } catch {
        // Ignore localStorage errors
      }
    }
  }, [chatOpen, messages, sessionId]);

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
  const mySideRef = useRef(mySide);
  mySideRef.current = mySide;

  // Determine if the user is a spectator (for gating lobby modal close)
  const myParticipant = currentUserId
    ? participants.find((p) => p.user_id === currentUserId)
    : (() => {
        if (!sessionId) return undefined;
        try {
          const storedParticipantId = localStorage.getItem(`live_draft_participant_${sessionId}`);
          return storedParticipantId ? participants.find((p) => p.id === storedParticipantId) : undefined;
        } catch {
          return undefined;
        }
      })();
  const isSpectator = myParticipant?.participant_type === 'spectator';

  // User must pick a role (captain or spectator) before closing the lobby modal
  const hasRole = isCaptain || isSpectator;

  // On initial load, if both teams are already ready and user has a role, skip the lobby modal
  const initialLoadDoneRef = useRef(false);
  useEffect(() => {
    if (loading || !session || initialLoadDoneRef.current) return;
    initialLoadDoneRef.current = true;

    const hasTeam1Captain = !!(session.team1_captain_id || session.team1_captain_display_name);
    const hasTeam2Captain = !!(session.team2_captain_id || session.team2_captain_display_name);
    const bothReady =
      hasTeam1Captain &&
      hasTeam2Captain &&
      session.team1_side &&
      session.team2_side &&
      session.team1_ready &&
      session.team2_ready;

    if (bothReady && hasRole) {
      setShowLobbyModal(false);
    }
  }, [loading, session, hasRole]);

  // Auto-close lobby modal when session is completed/cancelled
  useEffect(() => {
    if (session && (session.status === 'completed' || session.status === 'cancelled')) {
      setShowLobbyModal(false);
    }
  }, [session?.status]);

  // Detect when user has been kicked: they had a display name set but are no longer
  // recognized as captain in the session. Clear local state so the page resets.
  useEffect(() => {
    if (!session || !sessionId) return;

    // Skip kick detection while anonymous-to-auth linking is in progress.
    // The link effect will update session captain IDs once the RPC completes.
    if (currentUserId) {
      try {
        if (localStorage.getItem(`live_draft_participant_${sessionId}`)) return;
      } catch { /* ignore */ }
    }

    const hadIdentity = !!myDisplayName || !!storedDisplayName;
    if (hadIdentity && !isCaptain) {
      // For authenticated users: check if their ID isn't in either captain slot
      const isAuthKicked = currentUserId
        && session.team1_captain_id !== currentUserId
        && session.team2_captain_id !== currentUserId;

      // For anonymous users: check if their display name isn't in either captain slot
      const effectiveName = myDisplayName || storedDisplayName;
      const isAnonKicked = !currentUserId
        && effectiveName
        && session.team1_captain_display_name !== effectiveName
        && session.team2_captain_display_name !== effectiveName;

      if (isAuthKicked || isAnonKicked) {
        setMyDisplayName(null);
        setShowLobbyModal(true);
        try {
          localStorage.removeItem(`live_draft_display_name_${sessionId}`);
          localStorage.removeItem(`live_draft_participant_${sessionId}`);
        } catch {
          // Ignore localStorage errors
        }
      }
    }
  }, [session, sessionId, myDisplayName, storedDisplayName, isCaptain, currentUserId]);

  // Check if it's my turn in the draft (only when viewing the active game)
  const isMyTurn = useMemo(() => {
    if (!isViewingActiveGame || !activeGame || !mySide || activeGame.status !== 'drafting') return false;
    return activeGame.current_turn === mySide;
  }, [isViewingActiveGame, activeGame, mySide]);

  // Broadcast hovered champion to opponent via realtime channel
  useEffect(() => {
    if (!mySide) return;
    channelRef.current?.send({
      type: 'broadcast',
      event: 'champion_hovered',
      payload: { championId: selectedChampion, side: mySide },
    });
  }, [selectedChampion, mySide]);

  // Unread message count — excludes own messages, persists across refresh
  const unreadMessageCount = useMemo(() => {
    const myName = effectiveDisplayName || defaultDisplayName || null;

    const lastSeenIndex = lastSeenMessageId
      ? messages.findIndex(m => m.id === lastSeenMessageId)
      : -1;

    const unseenMessages = lastSeenMessageId !== null && lastSeenIndex !== -1
      ? messages.slice(lastSeenIndex + 1)
      : messages; // Never opened chat — all messages are unseen

    return unseenMessages.filter(m =>
      !(myName && m.display_name === myName)
    ).length;
  }, [messages, lastSeenMessageId, effectiveDisplayName, defaultDisplayName]);

  // Compute unavailable champions based on viewed game + fearless/ironman restrictions
  const unavailableChampions = useMemo(() => {
    const unavailable = new Set<string>();
    if (!viewedGame) return unavailable;

    // Add all picked and banned champions from viewed game (skip nulls and NONE_CHAMPION)
    [...viewedGame.blue_bans, ...viewedGame.red_bans, ...viewedGame.blue_picks, ...viewedGame.red_picks]
      .filter((id): id is string => id !== null && id !== NONE_CHAMPION)
      .forEach(id => unavailable.add(id));

    // Add fearless/ironman champions from previous games
    for (const uc of fearlessChampions) {
      if (session?.draft_mode === 'fearless' && myTeam) {
        // Fearless: only PICKS carry over (bans don't), and only for YOUR team.
        if (uc.reason !== 'picked') continue;
        // The DB stores the side (blue/red) that made the action, but teams
        // can swap sides between games. Resolve side → team using blue_side_team.
        const game = allGames.find(g => g.game_number === uc.from_game);
        if (game) {
          const ucTeam = uc.team === 'blue' ? game.blue_side_team
            : uc.team === 'red' ? (game.blue_side_team === 'team1' ? 'team2' : 'team1')
            : null;
          if (ucTeam === myTeam) {
            unavailable.add(uc.champion_id);
          }
        }
      } else {
        // Ironman: block all previously used champions (picks and bans)
        unavailable.add(uc.champion_id);
      }
    }

    return unavailable;
  }, [viewedGame, fearlessChampions, session?.draft_mode, myTeam, allGames]);

  // Keep a ref to selectedChampion so the timer closure always sees the latest value
  const selectedChampionRef = useRef(selectedChampion);
  selectedChampionRef.current = selectedChampion;

  // Timer countdown effect — always based on activeGame
  // Shows 0 on screen, then after a 2-second grace period auto-submits
  useEffect(() => {
    if (!activeGame || activeGame.status !== 'drafting' || !activeGame.turn_started_at || !session) {
      setTimerRemaining(null);
      return;
    }

    const currentStep = DRAFT_ORDER[activeGame.current_action_index];
    const timeLimit = currentStep?.actionType === 'ban' ? session.ban_time_seconds : session.pick_time_seconds;
    const turnStart = new Date(activeGame.turn_started_at).getTime();
    const actionIndex = activeGame.current_action_index;
    const GRACE_SECONDS = 2;

    const updateTimer = () => {
      const elapsed = Math.floor((Date.now() - turnStart) / 1000);
      const remaining = timeLimit - elapsed;
      // Display never goes below 0
      setTimerRemaining(Math.max(0, remaining));

      // After grace period: auto-submit (only once per action index)
      if (remaining <= -GRACE_SECONDS && autoSubmittedIndexRef.current !== actionIndex) {
        autoSubmittedIndexRef.current = actionIndex;

        // Only the captain whose turn it is should submit
        const isMyTurnNow = activeGame.current_turn === mySide;
        if (isMyTurnNow && !lockingRef.current) {
          const champion = selectedChampionRef.current;
          const hasValidChampion = champion && !unavailableChampions.has(champion);
          // If a valid champ is hovered, lock it in. Otherwise submit NONE_CHAMPION (blank ban/pick).
          const championToSubmit = hasValidChampion ? champion : NONE_CHAMPION;

          lockingRef.current = true;
          setIsLocking(true);
          liveDraftService.submitAction(activeGame.id, championToSubmit)
            .catch((err) => {
              // 23505 = duplicate key — the other code path already submitted this action
              if (err?.code === '23505') return;
              console.error('Auto-submit on timeout failed:', err);
              setError(err instanceof Error ? err.message : 'Auto-submit failed');
            })
            .finally(() => { lockingRef.current = false; setIsLocking(false); });
        }
      }
    };

    updateTimer();
    timerIntervalRef.current = setInterval(updateTimer, 250); // tick faster for accurate grace period

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [activeGame, session, mySide, unavailableChampions]);

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

    // Game doesn't exist — create it (captains only, not after completion)
    if (!isCaptain || !session || session.status === 'completed' || session.status === 'cancelled') return;

    const previousGame = allGames.find(g => g.game_number === gameNumber - 1);
    if (!previousGame || previousGame.status !== 'completed') return;

    try {
      // Clear side selections so captains must re-pick for the new game
      // (also handled by DB trigger on game complete, this is a fallback)
      const teamParam = currentUserId ? undefined : myTeam ?? undefined;
      try {
        await liveDraftService.clearSides(session.id, teamParam);
      } catch {
        // Non-fatal — the DB trigger should have already cleared sides
      }
      await liveDraftService.createGame(session.id, gameNumber);
      broadcastSessionUpdate();
      await loadSession();
      setViewedGameNumber(null); // Follow the new active game
    } catch (err) {
      console.error('Failed to start next game:', err);
      setError(err instanceof Error ? err.message : 'Failed to start next game');
    }
  }, [allGames, isCaptain, session, broadcastSessionUpdate, loadSession]);

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
      broadcastSessionUpdate();
      await loadSession();
    } catch (err) {
      console.error('Failed to toggle ready:', err);
      setError(err instanceof Error ? err.message : 'Failed to toggle ready');
    } finally {
      setReadyLoading(false);
    }
  };

  // Handle side selection from the draft board (games 2+)
  const [sidePickingLoading, setSidePickingLoading] = useState(false);

  const handleSelectSideFromBoard = async (side: DraftSide) => {
    if (!session || !myTeam || sidePickingLoading) return;

    setSidePickingLoading(true);
    setError(null);

    const teamParam = currentUserId ? undefined : myTeam;

    try {
      await liveDraftService.selectTeamSide(session.id, side, teamParam);
      broadcastSessionUpdate();
      await loadSession();
    } catch (err) {
      console.error('Failed to select side:', err);
      setError(err instanceof Error ? err.message : 'Failed to select side');
    } finally {
      setSidePickingLoading(false);
    }
  };

  const handleClearSide = async () => {
    if (!session || !myTeam || sidePickingLoading) return;

    setSidePickingLoading(true);
    setError(null);

    const teamParam = currentUserId ? undefined : myTeam;

    try {
      await liveDraftService.clearSides(session.id, teamParam);
      broadcastSessionUpdate();
      await loadSession();
    } catch (err) {
      console.error('Failed to clear side:', err);
      setError(err instanceof Error ? err.message : 'Failed to clear side');
    } finally {
      setSidePickingLoading(false);
    }
  };

  // Handle lock in
  const handleLockIn = async () => {
    if (!activeGame || !selectedChampion || !isMyTurn || lockingRef.current) return;

    // Prevent the auto-submit timer from racing with this manual lock-in
    autoSubmittedIndexRef.current = activeGame.current_action_index;

    lockingRef.current = true;
    setIsLocking(true);
    setError(null);

    try {
      await liveDraftService.submitAction(activeGame.id, selectedChampion);
    } catch (err) {
      // 23505 = duplicate key — the timer already auto-submitted this action
      if ((err as { code?: string })?.code === '23505') return;
      console.error('Failed to lock in:', err);
      setError(err instanceof Error ? err.message : 'Failed to lock in champion');
    } finally {
      lockingRef.current = false;
      setIsLocking(false);
    }
  };

  // Handle fill timed-out slot
  const handleFillSlotClick = (side: DraftSide, type: 'ban' | 'pick', index: number) => {
    setFillingSlot({ side, type, index });
    setSelectedChampion(null);
  };

  const handleFillCancel = () => {
    setFillingSlot(null);
    setSelectedChampion(null);
  };

  const handleFillConfirm = async () => {
    if (!fillingSlot || !selectedChampion || !viewedGame) return;

    const slot = `${fillingSlot.side}_${fillingSlot.type}_${fillingSlot.index}`;

    setIsFillingLoading(true);
    setError(null);

    try {
      await liveDraftService.fillTimedOutSlot(viewedGame.id, slot, selectedChampion);
      setFillingSlot(null);
      setSelectedChampion(null);
      // Reload games to reflect the update
      if (session) {
        const games = await liveDraftService.getGames(session.id);
        setAllGames(games);
        // Reload fearless champions if in fearless/ironman mode
        if (session.draft_mode !== 'normal') {
          const uc = await liveDraftService.getUnavailableChampions(session.id);
          setFearlessChampions(uc);
        }
      }
    } catch (err) {
      console.error('Failed to fill timed-out slot:', err);
      setError(err instanceof Error ? err.message : 'Failed to fill slot');
    } finally {
      setIsFillingLoading(false);
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
    <div className="flex flex-col h-[calc(100vh-24px)] -mt-4 -mb-6 -mr-8 overflow-y-hidden gap-2">
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
            {(() => {
              const isSessionDone = session.status === 'completed' || session.status === 'cancelled';
              // For finished sessions, only show games that were actually played
              const gameNumbers = isSessionDone
                ? allGames.filter(g => g.status === 'completed').map(g => g.game_number).sort((a, b) => a - b)
                : Array.from({ length: session.planned_games }, (_, i) => i + 1);

              return gameNumbers.map(gNum => {
                const game = allGames.find(g => g.game_number === gNum);
                const isCompleted = game?.status === 'completed';
                const isDrafting = game?.status === 'drafting';
                const isPending = game?.status === 'pending';
                const isViewed = gNum === (viewedGame?.game_number ?? 1);

                const previousGame = gNum === 1 ? null : allGames.find(g => g.game_number === gNum - 1);
                const isNextAvailable = !game && (gNum === 1 || previousGame?.status === 'completed');

                const isClickable = isCompleted || isDrafting || isPending || (isNextAvailable && isCaptain);

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
                            : isPending
                              ? 'border-lol-border text-gray-400 bg-lol-card hover:bg-lol-card-hover hover:text-gray-300 cursor-pointer'
                              : isNextAvailable && isCaptain
                                ? 'border-lol-border text-gray-500 bg-lol-dark hover:bg-lol-card hover:text-gray-400 cursor-pointer'
                                : 'border-lol-border/50 text-gray-700 bg-lol-dark/60 cursor-not-allowed'
                      }
                    `}
                    title={
                      isDrafting ? `Game ${gNum} (Live)`
                      : isCompleted ? `Game ${gNum} (Completed)`
                      : isPending ? `Game ${gNum} (Ready up)`
                      : isNextAvailable && isCaptain ? `Start Game ${gNum}`
                      : `Game ${gNum}`
                    }
                  >
                    G{gNum}
                  </button>
                );
              });
            })()}

            {/* Add game button — captains only, max 5, not after completion */}
            {isCaptain && session.planned_games < 5 && session.status !== 'completed' && session.status !== 'cancelled' && (
              <button
                onClick={async () => {
                  const teamParam = currentUserId ? undefined : myTeam ?? undefined;
                  try {
                    await liveDraftService.extendSeries(session.id, teamParam);
                    broadcastSessionUpdate();
                    await loadSession();
                  } catch (err) {
                    console.error('Failed to add game:', err);
                    setError(err instanceof Error ? err.message : 'Failed to add game');
                  }
                }}
                className="w-6 h-6 rounded text-[13px] font-medium transition-all border border-dashed border-lol-border text-gray-600 bg-transparent hover:border-lol-border-light hover:text-gray-400 hover:bg-lol-card flex items-center justify-center"
                title={`Extend series to ${session.planned_games + 1} games`}
              >
                +
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Restart game button (testing) */}
          {isCaptain && activeGame && (
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                if (!activeGame) return;
                try {
                  await liveDraftService.resetGame(activeGame.id);
                  setSelectedChampion(null);
                  const games = await liveDraftService.getGames(session.id);
                  setAllGames(games);
                } catch (err) {
                  console.error('Failed to reset game:', err);
                  setError(err instanceof Error ? err.message : 'Failed to reset game');
                }
              }}
              title="Restart current game (testing)"
              className="text-yellow-500/70 hover:text-yellow-400"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </Button>
          )}
          <SpectatorCount participants={participants} />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setChatOpen(!chatOpen)}
            className="relative"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {!chatOpen && unreadMessageCount > 0 && (
              <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-xs font-bold text-white bg-red-500 rounded-full">
                {unreadMessageCount > 9 ? '9+' : unreadMessageCount}
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
          {session.status !== 'completed' && session.status !== 'cancelled' && (
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
          )}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm text-center">
          {error}
        </div>
      )}

      {/* Board + Chat sidebar */}
      <div className={`flex flex-1 min-h-0 ${chatOpen ? '' : 'pr-8'}`}>
        <div className="flex-1 min-w-0 h-full">
          <LiveDraftBoard
            session={session}
            game={viewedGame ?? EMPTY_GAME}
            isMyTurn={isMyTurn}
            mySide={mySide ?? null}
            selectedChampion={isViewingActiveGame ? selectedChampion : null}
            opponentHoveredChampion={isViewingActiveGame ? opponentHoveredChampion : null}
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
            fearlessChampions={fearlessChampions}
            isLoggedIn={!!authUser}
            draftSessions={draftSessions}
            linkedDraftSession={linkedDraftSession}
            linkedDraftSessionId={linkedDraftSessionId}
            onLinkDraftSession={handleLinkDraftSession}
            contestedChampionIds={contestedChampionIds}
            onSelectSide={handleSelectSideFromBoard}
            onClearSide={handleClearSide}
            sidePickingLoading={sidePickingLoading}
            fillingSlot={fillingSlot}
            onFillSlotClick={handleFillSlotClick}
            onFillConfirm={handleFillConfirm}
            onFillCancel={handleFillCancel}
            isFillingLoading={isFillingLoading}
          />
        </div>

        {/* Chat sidebar - aligned with board */}
        <div className={`shrink-0 transition-all duration-200 overflow-hidden ${chatOpen ? 'w-72' : 'w-0'}`}>
          <div className="w-72 h-full">
            <LiveDraftChat
              sessionId={session.id}
              messages={messages}
              avatarMap={{
                ...(session.team1_captain_display_name && session.team1_captain_avatar_url
                  ? { [session.team1_captain_display_name]: session.team1_captain_avatar_url }
                  : {}),
                ...(session.team2_captain_display_name && session.team2_captain_avatar_url
                  ? { [session.team2_captain_display_name]: session.team2_captain_avatar_url }
                  : {}),
              }}
              isCaptain={isCaptain}
              currentUserDisplayName={effectiveDisplayName || defaultDisplayName || null}
              onClose={() => setChatOpen(false)}
              headerHeight={boardHeaderHeight}
              isSessionCompleted={session.status === 'completed' || session.status === 'cancelled'}
            />
          </div>
        </div>
      </div>

      {/* Lobby Modal — hidden when session is done */}
      {session.status !== 'completed' && session.status !== 'cancelled' && (
        <LiveDraftLobbyModal
          isOpen={showLobbyModal}
          onClose={() => { if (hasRole) setShowLobbyModal(false); }}
          session={session}
          participants={participants}
          currentUserId={currentUserId}
          myDisplayName={myDisplayName}
          setMyDisplayName={setMyDisplayName}
          defaultDisplayName={defaultDisplayName}
          loadSession={loadSession}
          setError={setError}
          broadcastSessionUpdate={broadcastSessionUpdate}
          onDeleteSession={async () => {
            await liveDraftService.deleteSession(session.id);
            navigate('/live-draft');
          }}
          onEndSession={session.status === 'in_progress' ? async () => {
            // Delete any pending (unstarted) games before completing
            const pendingGames = allGames.filter(g => g.status === 'pending');
            for (const pg of pendingGames) {
              await liveDraftService.deleteGame(pg.id);
            }
            const completedCount = allGames.filter(g => g.status === 'completed').length;
            await liveDraftService.endSession(session.id, completedCount);
            navigate('/live-draft');
          } : undefined}
          hasActiveDraft={!!activeGame}
          onLeaveSession={async () => {
            await liveDraftService.hideSession(session.id);
            navigate('/live-draft');
          }}
        />
      )}
    </div>
  );
}

