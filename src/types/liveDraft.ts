// Live Draft Types
// Real-time collaborative draft tool types

// ============================================
// ENUMS / CONSTANTS
// ============================================

export type DraftMode = 'normal' | 'fearless' | 'ironman';
export type SessionStatus = 'lobby' | 'in_progress' | 'paused' | 'completed' | 'cancelled';
export type GameStatus = 'pending' | 'drafting' | 'completed' | 'editing';
export type DraftPhase = 'ban1' | 'pick1' | 'ban2' | 'pick2';
export type DraftSide = 'blue' | 'red';
export type TeamSide = 'team1' | 'team2';
export type ParticipantType = 'controller' | 'spectator';
export type DraftActionType = 'ban' | 'pick' | 'timeout';

/** Sentinel champion ID used when a ban/pick times out with no selection */
export const NONE_CHAMPION = '__none__';

// ============================================
// DATABASE ROW TYPES
// ============================================

export interface DbLiveDraftSession {
  id: string;
  name: string;
  created_by: string | null;

  // Teams (independent of sides)
  team1_name: string;
  team2_name: string;
  team1_captain_id: string | null;
  team2_captain_id: string | null;
  team1_captain_display_name: string | null;
  team2_captain_display_name: string | null;
  team1_captain_avatar_url: string | null;
  team1_captain_role: string | null;
  team1_captain_role_team_name: string | null;
  team2_captain_avatar_url: string | null;
  team2_captain_role: string | null;
  team2_captain_role_team_name: string | null;

  // Which side each team chose
  team1_side: DraftSide | null;
  team2_side: DraftSide | null;

  // Ready state for captains
  team1_ready: boolean;
  team2_ready: boolean;

  // Linked resources
  team1_linked_draft_id: string | null;
  team2_linked_draft_id: string | null;
  team1_linked_team_id: string | null;
  team2_linked_team_id: string | null;
  team1_linked_enemy_id: string | null;
  team2_linked_enemy_id: string | null;

  // Config
  draft_mode: DraftMode;
  planned_games: number;
  pick_time_seconds: number;
  ban_time_seconds: number;

  // State
  status: SessionStatus;
  current_game_number: number;

  // Tokens
  invite_token: string;

  // Timestamps
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbLiveDraftGame {
  id: string;
  session_id: string;
  game_number: number;

  blue_side_team: TeamSide;

  status: GameStatus;
  current_phase: DraftPhase | null;
  current_turn: DraftSide | null;
  current_action_index: number;

  turn_started_at: string | null;

  blue_bans: (string | null)[];
  red_bans: (string | null)[];
  blue_picks: (string | null)[];
  red_picks: (string | null)[];

  edited_picks: EditedPick[];

  winner: DraftSide | null;

  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbLiveDraftParticipant {
  id: string;
  session_id: string;
  user_id: string | null;

  participant_type: ParticipantType;
  team: DraftSide | null;
  display_name: string | null;

  is_connected: boolean;
  last_seen_at: string;
  is_captain: boolean;

  joined_at: string;
}

export interface DbLiveDraftUnavailableChampion {
  id: string;
  session_id: string;
  champion_id: string;
  from_game: number;
  reason: 'picked' | 'banned';
  team: DraftSide | null;
  created_at: string;
}

export interface DbLiveDraftAction {
  id: string;
  game_id: string;
  action_index: number;
  action_type: DraftActionType;
  team: DraftSide;
  champion_id: string | null;
  performed_by: string | null;
  created_at: string;
}

export interface DbLiveDraftMessage {
  id: string;
  session_id: string;
  user_id: string | null;
  display_name: string;
  content: string;
  created_at: string;
}

// ============================================
// APPLICATION TYPES
// ============================================

export interface EditedPick {
  slot: string; // e.g., "blue_pick_3"
  original: string | null;
  edited: string;
  at: string;
}

export interface LiveDraftSession extends DbLiveDraftSession {
  games?: LiveDraftGame[];
  participants?: LiveDraftParticipant[];
}

export interface LiveDraftGame extends DbLiveDraftGame {
  actions?: LiveDraftAction[];
}

export interface LiveDraftParticipant extends DbLiveDraftParticipant {
  // Extended with profile data when available
  profile?: {
    display_name: string | null;
    avatar_url: string | null;
    role: string | null;
    role_team_id: string | null;
    role_team: { name: string } | null;
  };
}

export interface LiveDraftAction extends DbLiveDraftAction {}

export interface LiveDraftMessage extends DbLiveDraftMessage {
  // Extended with profile data when available
  profile?: {
    avatar_url: string | null;
  };
}

// ============================================
// SESSION CREATION / CONFIG
// ============================================

export interface CreateLiveDraftSessionConfig {
  name: string;
  draftMode: DraftMode;
  plannedGames: number;
  pickTimeSeconds: number;
  banTimeSeconds: number;

  // Team names (independent of sides - captains choose side in lobby)
  team1Name?: string;
  team2Name?: string;

  // Optional linked resources (for logged-in users)
  linkedDraftId?: string;
  linkedTeamId?: string;
  linkedEnemyId?: string;
}

export interface JoinSessionResult {
  session: LiveDraftSession;
  participant: LiveDraftParticipant;
  isSpectator: boolean;
}

// ============================================
// DRAFT ORDER
// ============================================

export interface DraftOrderStep {
  phase: DraftPhase;
  turn: DraftSide;
  actionType: DraftActionType;
  index: number; // Index within the ban/pick array (0-4)
}

// Standard LoL draft order (20 actions total)
export const DRAFT_ORDER: DraftOrderStep[] = [
  // Ban Phase 1 (6 bans)
  { phase: 'ban1', turn: 'blue', actionType: 'ban', index: 0 },
  { phase: 'ban1', turn: 'red', actionType: 'ban', index: 0 },
  { phase: 'ban1', turn: 'blue', actionType: 'ban', index: 1 },
  { phase: 'ban1', turn: 'red', actionType: 'ban', index: 1 },
  { phase: 'ban1', turn: 'blue', actionType: 'ban', index: 2 },
  { phase: 'ban1', turn: 'red', actionType: 'ban', index: 2 },
  // Pick Phase 1 (6 picks)
  { phase: 'pick1', turn: 'blue', actionType: 'pick', index: 0 },
  { phase: 'pick1', turn: 'red', actionType: 'pick', index: 0 },
  { phase: 'pick1', turn: 'red', actionType: 'pick', index: 1 },
  { phase: 'pick1', turn: 'blue', actionType: 'pick', index: 1 },
  { phase: 'pick1', turn: 'blue', actionType: 'pick', index: 2 },
  { phase: 'pick1', turn: 'red', actionType: 'pick', index: 2 },
  // Ban Phase 2 (4 bans)
  { phase: 'ban2', turn: 'red', actionType: 'ban', index: 3 },
  { phase: 'ban2', turn: 'blue', actionType: 'ban', index: 3 },
  { phase: 'ban2', turn: 'red', actionType: 'ban', index: 4 },
  { phase: 'ban2', turn: 'blue', actionType: 'ban', index: 4 },
  // Pick Phase 2 (4 picks)
  { phase: 'pick2', turn: 'red', actionType: 'pick', index: 3 },
  { phase: 'pick2', turn: 'blue', actionType: 'pick', index: 3 },
  { phase: 'pick2', turn: 'blue', actionType: 'pick', index: 4 },
  { phase: 'pick2', turn: 'red', actionType: 'pick', index: 4 },
];

// ============================================
// REALTIME EVENTS
// ============================================

export interface DraftActionEvent {
  gameId: string;
  actionIndex: number;
  actionType: DraftActionType;
  team: DraftSide;
  championId: string | null;
  performedBy: string | null;
}

export interface HoverEvent {
  gameId: string;
  team: DraftSide;
  championId: string | null;
}

export interface TimerEvent {
  gameId: string;
  remaining: number;
  phase: DraftPhase;
  turn: DraftSide;
}

export interface GameStateEvent {
  gameId: string;
  status: GameStatus;
  phase: DraftPhase | null;
  turn: DraftSide | null;
  actionIndex: number;
}

export interface ChatMessageEvent {
  id: string;
  sessionId: string;
  userId: string | null;
  displayName: string;
  content: string;
  createdAt: string;
}

export interface PresenceState {
  participantId: string;
  odId: string | null;
  displayName: string;
  team: DraftSide | null;
  isCaptain: boolean;
  isConnected: boolean;
}

// ============================================
// STORE STATE
// ============================================

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

export interface LiveDraftState {
  // Current session
  currentSession: LiveDraftSession | null;
  currentGame: LiveDraftGame | null;
  participants: LiveDraftParticipant[];
  messages: LiveDraftMessage[];

  // Local UI state
  hoveredChampion: string | null;
  selectedChampion: string | null;
  timerRemaining: number | null;

  // Unavailable champions (computed from mode rules)
  unavailableChampions: Set<string>;

  // Connection state
  connectionStatus: ConnectionStatus;
  lastSyncTimestamp: number | null;

  // My participation
  myParticipant: LiveDraftParticipant | null;
  isMyTurn: boolean;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get the current draft step based on action index
 */
export function getDraftStep(actionIndex: number): DraftOrderStep | null {
  return DRAFT_ORDER[actionIndex] ?? null;
}

/**
 * Check if a champion is unavailable in the current context
 */
export function isChampionUnavailable(
  championId: string,
  mode: DraftMode,
  currentGame: LiveDraftGame,
  unavailableChampions: DbLiveDraftUnavailableChampion[],
  currentTeam?: DraftSide
): boolean {
  // Always unavailable if already picked/banned in current game
  const allCurrentChampions = [
    ...currentGame.blue_bans,
    ...currentGame.red_bans,
    ...currentGame.blue_picks,
    ...currentGame.red_picks,
  ].filter(Boolean);

  if (allCurrentChampions.includes(championId)) {
    return true;
  }

  // For normal mode, only current game matters
  if (mode === 'normal') {
    return false;
  }

  // For fearless mode, check if this team has used it before
  if (mode === 'fearless' && currentTeam) {
    return unavailableChampions.some(
      (uc) => uc.champion_id === championId && uc.team === currentTeam
    );
  }

  // For ironman mode, check if any team has used it
  if (mode === 'ironman') {
    return unavailableChampions.some((uc) => uc.champion_id === championId);
  }

  return false;
}

/**
 * Calculate series score from games
 */
export function getSeriesScore(games: LiveDraftGame[]): { team1: number; team2: number } {
  let team1 = 0;
  let team2 = 0;

  for (const game of games) {
    if (game.winner) {
      const winnerIsTeam1 =
        (game.winner === 'blue' && game.blue_side_team === 'team1') ||
        (game.winner === 'red' && game.blue_side_team === 'team2');

      if (winnerIsTeam1) {
        team1++;
      } else {
        team2++;
      }
    }
  }

  return { team1, team2 };
}

/**
 * Get display name for a participant
 */
export function getParticipantDisplayName(participant: LiveDraftParticipant): string {
  return participant.profile?.display_name || participant.display_name || 'Anonymous';
}
