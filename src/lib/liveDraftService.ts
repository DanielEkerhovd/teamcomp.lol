import { supabase } from './supabase';
import { checkModerationAndRecord, getViolationWarning } from './moderation';
import {
  DRAFT_ORDER,
  type DbLiveDraftSession,
  type DbLiveDraftGame,
  type DbLiveDraftParticipant,
  type DbLiveDraftMessage,
  type DbLiveDraftUnavailableChampion,
  type LiveDraftSession,
  type LiveDraftGame,
  type LiveDraftParticipant,
  type LiveDraftMessage,
  type CreateLiveDraftSessionConfig,
  type JoinSessionResult,
  type DraftSide,
  type DraftMode,
} from '../types/liveDraft';

// ============================================
// MAPPERS
// ============================================

function mapSession(row: DbLiveDraftSession): LiveDraftSession {
  return { ...row };
}

function mapGame(row: DbLiveDraftGame): LiveDraftGame {
  return { ...row };
}

function mapParticipant(row: DbLiveDraftParticipant): LiveDraftParticipant {
  return { ...row };
}

function mapMessage(row: DbLiveDraftMessage): LiveDraftMessage {
  return { ...row };
}

// ============================================
// SERVICE
// ============================================

export const CHAT_MESSAGE_CAP = 50;

export const liveDraftService = {
  // ==========================================
  // SESSION MANAGEMENT
  // ==========================================

  /**
   * Create a new live draft session
   * Creator is NOT automatically assigned as captain - they choose their team in the lobby
   */
  async createSession(config: CreateLiveDraftSessionConfig): Promise<LiveDraftSession> {
    if (!supabase) throw new Error('Supabase not initialized');

    if (config.name && config.name.length > 30) throw new Error('Session name must be 30 characters or less');
    if (config.team1Name && config.team1Name.length > 30) throw new Error('Team name must be 30 characters or less');
    if (config.team2Name && config.team2Name.length > 30) throw new Error('Team name must be 30 characters or less');

    // Moderate user-provided text fields (batch check)
    const textsToCheck = [config.name, config.team1Name, config.team2Name].filter(
      (t): t is string => !!t && t.trim().length > 0
    );
    if (textsToCheck.length > 0) {
      const modResult = await checkModerationAndRecord(textsToCheck, 'live_draft_session');
      if (modResult.flagged) throw new Error(getViolationWarning(modResult));
    }

    const { data: { session: authSession } } = await supabase.auth.getSession();

    const insertData: Partial<DbLiveDraftSession> = {
      name: config.name,
      created_by: authSession?.user?.id ?? null,
      draft_mode: config.draftMode,
      planned_games: config.plannedGames,
      pick_time_seconds: config.pickTimeSeconds,
      ban_time_seconds: config.banTimeSeconds,
      team1_name: config.team1Name || 'Team 1',
      team2_name: config.team2Name || 'Team 2',
      team1_linked_draft_id: config.linkedDraftId ?? null,
      team1_linked_team_id: config.linkedTeamId ?? null,
      team1_linked_enemy_id: config.linkedEnemyId ?? null,
      // Do NOT auto-assign captain - user picks their team in lobby
      team1_captain_id: null,
      team2_captain_id: null,
      team1_ready: false,
      team2_ready: false,
    };

    const { data, error } = await supabase
      .from('live_draft_sessions')
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new Error('Failed to create session');

    const session = mapSession(data as DbLiveDraftSession);

    // Create the first game
    await this.createGame(session.id, 1);

    return session;
  },

  /**
   * Get all sessions for the current user (excludes hidden sessions)
   */
  async getUserSessions(): Promise<LiveDraftSession[]> {
    if (!supabase) return [];

    // Use getSession() (cached, no network call) instead of getUser() which can hang
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session?.user) return [];
    const userId = sessionData.session.user.id;

    // Get sessions from user_sessions table (excludes hidden)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: userSessions, error: userSessionsError } = await (supabase
      .from('live_draft_user_sessions') as any)
      .select('session_id')
      .eq('user_id', userId)
      .is('hidden_at', null);

    if (userSessionsError) throw userSessionsError;
    if (!userSessions || userSessions.length === 0) return [];

    const sessionIds = userSessions.map((us: { session_id: string }) => us.session_id);

    // Get the actual session data
    const { data, error } = await supabase
      .from('live_draft_sessions')
      .select('*')
      .in('id', sessionIds)
      .order('created_at', { ascending: false });

    if (error) throw error;
    const sessions = (data || []).map((row) => mapSession(row as DbLiveDraftSession));

    // For completed/cancelled sessions, patch planned_games and current_game_number
    // to reflect the actual number of completed games (handles stale data).
    const doneIds = sessions
      .filter(s => s.status === 'completed' || s.status === 'cancelled')
      .map(s => s.id);

    if (doneIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: gameCounts } = await (supabase
        .from('live_draft_games') as any)
        .select('session_id')
        .in('session_id', doneIds)
        .eq('status', 'completed');

      if (gameCounts) {
        const countMap = new Map<string, number>();
        for (const g of gameCounts as { session_id: string }[]) {
          countMap.set(g.session_id, (countMap.get(g.session_id) ?? 0) + 1);
        }
        for (const s of sessions) {
          const cnt = countMap.get(s.id);
          if (cnt !== undefined) {
            s.planned_games = cnt;
            s.current_game_number = cnt;
          }
        }
      }
    }

    return sessions;
  },

  /**
   * Hide a session from the user's view
   * If all users hide the session, it will be automatically deleted
   */
  async hideSession(sessionId: string): Promise<void> {
    if (!supabase) return;

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session?.user) throw new Error('Must be logged in');

    // Mark the session as hidden for this user
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase
      .from('live_draft_user_sessions') as any)
      .update({ hidden_at: new Date().toISOString() })
      .eq('session_id', sessionId)
      .eq('user_id', sessionData.session.user.id);

    if (error) throw error;
  },

  /**
   * Get a session by ID
   */
  async getSession(sessionId: string): Promise<LiveDraftSession | null> {
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('live_draft_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }

    return data ? mapSession(data as DbLiveDraftSession) : null;
  },

  /**
   * Get a session by invite token
   */
  async getSessionByToken(token: string): Promise<LiveDraftSession | null> {
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('live_draft_sessions')
      .select('*')
      .eq('invite_token', token)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data ? mapSession(data as DbLiveDraftSession) : null;
  },

  /**
   * Update session configuration
   */
  async updateSession(
    sessionId: string,
    updates: Partial<
      Pick<
        DbLiveDraftSession,
        | 'name'
        | 'team1_name'
        | 'team2_name'
        | 'team1_side'
        | 'draft_mode'
        | 'planned_games'
        | 'pick_time_seconds'
        | 'ban_time_seconds'
        | 'status'
      >
    >
  ): Promise<void> {
    if (!supabase) return;

    const { error } = await supabase
      .from('live_draft_sessions')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(updates as any)
      .eq('id', sessionId);

    if (error) throw error;
  },

  /**
   * Start the session (move from lobby to in_progress)
   */
  async startSession(sessionId: string): Promise<void> {
    if (!supabase) return;

    // Get session to determine side assignments
    const session = await this.getSession(sessionId);
    if (!session) throw new Error('Session not found');

    const { error } = await supabase
      .from('live_draft_sessions')
      .update({
        status: 'in_progress',
        started_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (error) throw error;

    // Determine which team is on blue side based on lobby side selection
    const blueSideTeam: 'team1' | 'team2' = session.team1_side === 'blue' ? 'team1' : 'team2';

    // Start the first game with correct side assignment
    const games = await this.getGames(sessionId);
    if (games.length > 0) {
      // Update the game's blue_side_team before starting
      await (supabase
        .from('live_draft_games') as any)
        .update({ blue_side_team: blueSideTeam })
        .eq('id', games[0].id);

      await this.startGame(games[0].id);
    }
  },

  /**
   * End the session.
   * @param completedGames — number of games actually played; when provided
   *   the session's planned_games and current_game_number are synced so that
   *   history shows e.g. "3 / 3" instead of "3 / 5".
   */
  async endSession(sessionId: string, completedGames?: number): Promise<void> {
    if (!supabase) return;

    const updates: Record<string, unknown> = {
      status: 'completed',
      completed_at: new Date().toISOString(),
    };

    if (completedGames !== undefined) {
      updates.planned_games = completedGames;
      updates.current_game_number = completedGames;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase
      .from('live_draft_sessions') as any)
      .update(updates)
      .eq('id', sessionId);

    if (error) throw error;
  },

  /**
   * Cancel the session
   */
  async cancelSession(sessionId: string): Promise<void> {
    if (!supabase) return;

    const { error } = await supabase
      .from('live_draft_sessions')
      .update({ status: 'cancelled' })
      .eq('id', sessionId);

    if (error) throw error;
  },

  /**
   * Delete the session and all related data (only the creator can do this)
   */
  async deleteSession(sessionId: string): Promise<void> {
    if (!supabase) throw new Error('Supabase not initialized');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('delete_live_draft_session', {
      p_session_id: sessionId,
    });

    if (error) throw error;
    if (!data?.success) {
      throw new Error(data?.message || 'Failed to delete session');
    }
  },

  /**
   * Kick a captain from a team slot (only the session creator can do this)
   * Useful when an anonymous user joins then logs in, locking the session
   */
  async kickCaptain(sessionId: string, team: 'team1' | 'team2'): Promise<void> {
    if (!supabase) throw new Error('Supabase not initialized');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('kick_live_draft_captain', {
      p_session_id: sessionId,
      p_team: team,
    });

    if (error) throw error;
    if (!data?.success) {
      throw new Error(data?.message || 'Failed to kick captain');
    }
  },

  // ==========================================
  // GAME MANAGEMENT
  // ==========================================

  /**
   * Create a new game in the session
   */
  async createGame(sessionId: string, gameNumber: number): Promise<LiveDraftGame> {
    if (!supabase) throw new Error('Supabase not initialized');

    const { data, error } = await supabase
      .from('live_draft_games')
      .insert({
        session_id: sessionId,
        game_number: gameNumber,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new Error('Failed to create game');

    // Keep session's current_game_number in sync
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase
      .from('live_draft_sessions') as any)
      .update({ current_game_number: gameNumber })
      .eq('id', sessionId);

    return mapGame(data as DbLiveDraftGame);
  },

  /**
   * Get all games for a session
   */
  async getGames(sessionId: string): Promise<LiveDraftGame[]> {
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('live_draft_games')
      .select('*')
      .eq('session_id', sessionId)
      .order('game_number', { ascending: true });

    if (error) throw error;
    return (data || []).map((row) => mapGame(row as DbLiveDraftGame));
  },

  /**
   * Get a specific game
   */
  async getGame(gameId: string): Promise<LiveDraftGame | null> {
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('live_draft_games')
      .select('*')
      .eq('id', gameId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data ? mapGame(data as DbLiveDraftGame) : null;
  },

  /**
   * Delete a game (e.g. pending games when ending a session)
   */
  async deleteGame(gameId: string): Promise<void> {
    if (!supabase) return;

    const { error } = await supabase
      .from('live_draft_games')
      .delete()
      .eq('id', gameId);

    if (error) throw error;
  },

  /**
   * Start a game (begin drafting)
   */
  async startGame(gameId: string): Promise<void> {
    if (!supabase) return;

    const firstStep = DRAFT_ORDER[0];

    const { error } = await supabase
      .from('live_draft_games')
      .update({
        status: 'drafting',
        current_phase: firstStep.phase,
        current_turn: firstStep.turn,
        current_action_index: 0,
        started_at: new Date().toISOString(),
        turn_started_at: new Date().toISOString(),
      })
      .eq('id', gameId);

    if (error) throw error;
  },

  /**
   * Update game state (advance to next action)
   */
  async advanceGame(gameId: string): Promise<LiveDraftGame | null> {
    if (!supabase) return null;

    const game = await this.getGame(gameId);
    if (!game) return null;

    const nextIndex = game.current_action_index + 1;

    // Check if draft is complete
    if (nextIndex >= DRAFT_ORDER.length) {
      const { data, error } = await supabase
        .from('live_draft_games')
        .update({
          status: 'completed',
          current_phase: null,
          current_turn: null,
          completed_at: new Date().toISOString(),
        })
        .eq('id', gameId)
        .select()
        .single();

      if (error) throw error;
      return data ? mapGame(data as DbLiveDraftGame) : null;
    }

    // Advance to next step
    const nextStep = DRAFT_ORDER[nextIndex];

    const { data, error } = await supabase
      .from('live_draft_games')
      .update({
        current_phase: nextStep.phase,
        current_turn: nextStep.turn,
        current_action_index: nextIndex,
        turn_started_at: new Date().toISOString(),
      })
      .eq('id', gameId)
      .select()
      .single();

    if (error) throw error;
    return data ? mapGame(data as DbLiveDraftGame) : null;
  },

  /**
   * Reset a game back to the start of drafting (for testing)
   */
  async resetGame(gameId: string): Promise<void> {
    if (!supabase) return;

    const firstStep = DRAFT_ORDER[0];

    const { error } = await supabase
      .from('live_draft_games')
      .update({
        status: 'drafting',
        current_phase: firstStep.phase,
        current_turn: firstStep.turn,
        current_action_index: 0,
        turn_started_at: new Date().toISOString(),
        blue_bans: [null, null, null, null, null],
        red_bans: [null, null, null, null, null],
        blue_picks: [null, null, null, null, null],
        red_picks: [null, null, null, null, null],
        edited_picks: [],
        winner: null,
        completed_at: null,
      })
      .eq('id', gameId);

    if (error) throw error;
  },

  /**
   * Record game result
   */
  async recordGameResult(gameId: string, winner: DraftSide): Promise<void> {
    if (!supabase) return;

    const { error } = await supabase
      .from('live_draft_games')
      .update({
        winner,
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', gameId);

    if (error) throw error;
  },

  /**
   * Set side for a game (side selection phase)
   */
  async selectSide(gameId: string, blueSideTeam: 'team1' | 'team2'): Promise<void> {
    if (!supabase) return;

    const { error } = await supabase
      .from('live_draft_games')
      .update({ blue_side_team: blueSideTeam })
      .eq('id', gameId);

    if (error) throw error;
  },

  /**
   * Add more games to the session
   */
  async addGamesToSession(sessionId: string, count: number = 1): Promise<LiveDraftGame[]> {
    const games = await this.getGames(sessionId);
    const nextGameNumber = games.length + 1;

    const newGames: LiveDraftGame[] = [];
    for (let i = 0; i < count; i++) {
      const game = await this.createGame(sessionId, nextGameNumber + i);
      newGames.push(game);
    }

    // Update planned games count
    await this.updateSession(sessionId, {
      planned_games: games.length + count,
    });

    return newGames;
  },

  // ==========================================
  // PARTICIPANT MANAGEMENT
  // ==========================================

  /**
   * Join session as captain for a specific team (Team 1 or Team 2)
   * Supports both logged-in users and anonymous users
   */
  async joinAsTeamCaptain(
    sessionId: string,
    team: 'team1' | 'team2',
    displayName: string
  ): Promise<JoinSessionResult> {
    if (!supabase) throw new Error('Supabase not initialized');
    if (!displayName?.trim()) throw new Error('Display name is required');
    if (displayName.trim().length > 30) throw new Error('Display name must be 30 characters or less');

    // Moderate captain display name
    const modResult = await checkModerationAndRecord(displayName.trim(), 'display_name');
    if (modResult.flagged) throw new Error(getViolationWarning(modResult));

    const { data: { session: authSession } } = await supabase.auth.getSession();
    const userId = authSession?.user?.id ?? null;
    const finalDisplayName = displayName.trim();

    // Fetch profile info for logged-in users to store on the session
    let avatarUrl: string | null = null;
    let role: string | null = null;
    let roleTeamName: string | null = null;

    if (userId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('avatar_url, role, role_team:my_teams!profiles_role_team_id_fkey(name)')
        .eq('id', userId)
        .single();

      if (profile) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        avatarUrl = (profile as any).avatar_url ?? null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        role = (profile as any).role ?? null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        roleTeamName = (profile as any).role_team?.name ?? null;
      }
    }

    const session = await this.getSession(sessionId);
    if (!session) throw new Error('Session not found');

    // Check if the team slot is available
    const captainField = team === 'team1' ? 'team1_captain_id' : 'team2_captain_id';
    const otherCaptainField = team === 'team1' ? 'team2_captain_id' : 'team1_captain_id';
    const displayNameField = team === 'team1' ? 'team1_captain_display_name' : 'team2_captain_display_name';
    const otherDisplayNameField = team === 'team1' ? 'team2_captain_display_name' : 'team1_captain_display_name';

    const existingCaptainId = session[captainField];
    const existingCaptainDisplayName = session[displayNameField];

    // Check if slot is taken by someone else
    if (existingCaptainId && existingCaptainId !== userId) {
      throw new Error(`${team === 'team1' ? session.team1_name : session.team2_name} already has a captain`);
    }
    // For anonymous users, check if display name matches (simple re-join check)
    if (!existingCaptainId && existingCaptainDisplayName && existingCaptainDisplayName !== finalDisplayName) {
      throw new Error(`${team === 'team1' ? session.team1_name : session.team2_name} already has a captain`);
    }

    // Check user is not already captain of the other team (only for logged-in users)
    if (userId && session[otherCaptainField] === userId) {
      throw new Error('You are already captain of the other team');
    }
    // For anonymous, check by display name
    if (!userId && session[otherDisplayNameField] === finalDisplayName) {
      throw new Error('You are already captain of the other team');
    }

    // Use RPC function to join as captain (handles RLS for anonymous users)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rpcResult, error: rpcError } = await (supabase.rpc as any)('join_live_draft_as_captain', {
      p_session_id: sessionId,
      p_team: team,
      p_display_name: finalDisplayName,
      p_avatar_url: avatarUrl,
      p_role: role,
      p_role_team_name: roleTeamName,
    });

    if (rpcError) throw rpcError;
    if (!rpcResult?.success) {
      throw new Error('Failed to join as captain');
    }

    // Create participant record
    let participantData: DbLiveDraftParticipant;

    if (userId) {
      // For logged-in users, upsert by session_id + user_id
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase
        .from('live_draft_participants') as any)
        .upsert({
          session_id: sessionId,
          user_id: userId,
          participant_type: 'controller',
          team: null,
          display_name: finalDisplayName,
          is_captain: true,
          is_connected: true,
        }, { onConflict: 'session_id,user_id' })
        .select()
        .single();

      if (error) throw error;
      participantData = data as DbLiveDraftParticipant;
    } else {
      // For anonymous users, user_id must be null (foreign key constraint to profiles)
      // Check if we have an existing participant ID from localStorage
      let existingParticipantId: string | null = null;
      try {
        existingParticipantId = localStorage.getItem(`live_draft_participant_${sessionId}`);
      } catch {
        // Ignore localStorage errors
      }

      let insertNew = true;

      // If we have an existing participant, try to update it
      if (existingParticipantId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase
          .from('live_draft_participants') as any)
          .update({
            participant_type: 'controller',
            team: null,
            display_name: finalDisplayName,
            is_captain: true,
            is_connected: true,
          })
          .eq('id', existingParticipantId)
          .select()
          .single();

        if (!error && data) {
          participantData = data as DbLiveDraftParticipant;
          insertNew = false;
        }
        // If update fails (participant deleted), fall through to insert
      }

      // Insert new participant if no existing one
      if (insertNew) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase
          .from('live_draft_participants') as any)
          .insert({
            session_id: sessionId,
            user_id: null,
            participant_type: 'controller',
            team: null,
            display_name: finalDisplayName,
            is_captain: true,
            is_connected: true,
          })
          .select()
          .single();

        if (error) throw error;
        participantData = data as DbLiveDraftParticipant;

        // Store participant ID in localStorage for reconnection
        try {
          localStorage.setItem(`live_draft_participant_${sessionId}`, participantData.id);
        } catch {
          // Ignore localStorage errors
        }
      }
    }

    const updatedSession = await this.getSession(sessionId);
    if (!updatedSession) throw new Error('Session not found');

    return {
      session: updatedSession,
      participant: mapParticipant(participantData),
      isSpectator: false,
    };
  },

  /**
   * Select a side (blue/red) for the captain's team
   * Uses RPC function for both logged-in and anonymous users
   * @param team - Required for anonymous users, optional for logged-in users
   */
  async selectTeamSide(sessionId: string, side: DraftSide, team?: 'team1' | 'team2'): Promise<void> {
    if (!supabase) throw new Error('Supabase not initialized');

    // Use RPC function which has SECURITY DEFINER to bypass RLS
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rpcResult, error: rpcError } = await (supabase.rpc as any)('select_live_draft_side', {
      p_session_id: sessionId,
      p_side: side,
      p_team: team ?? null,
    });

    if (rpcError) throw rpcError;
    if (!rpcResult?.success) {
      throw new Error(rpcResult?.message || 'Failed to select side');
    }
  },

  /**
   * Clear both teams' side selections (for "undo" between games)
   * Uses RPC function for both logged-in and anonymous users
   * @param team - Required for anonymous users, optional for logged-in users
   */
  async clearSides(sessionId: string, team?: 'team1' | 'team2'): Promise<void> {
    if (!supabase) throw new Error('Supabase not initialized');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rpcResult, error: rpcError } = await (supabase.rpc as any)('clear_live_draft_sides', {
      p_session_id: sessionId,
      p_team: team ?? null,
    });

    if (rpcError) throw rpcError;
    if (!rpcResult?.success) {
      throw new Error(rpcResult?.message || 'Failed to clear sides');
    }
  },

  /**
   * Set ready state for the captain
   * Uses RPC function for both logged-in and anonymous users
   * @param team - Required for anonymous users, optional for logged-in users
   */
  async setReady(sessionId: string, ready: boolean, team?: 'team1' | 'team2'): Promise<void> {
    if (!supabase) throw new Error('Supabase not initialized');

    // Use RPC function which has SECURITY DEFINER to bypass RLS
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rpcResult, error: rpcError } = await (supabase.rpc as any)('set_live_draft_ready', {
      p_session_id: sessionId,
      p_ready: ready,
      p_team: team ?? null,
    });

    if (rpcError) throw rpcError;
    if (!rpcResult?.success) {
      throw new Error(rpcResult?.message || 'Failed to set ready state');
    }
  },

  /**
   * Extend series by 1 game (max 5)
   * Uses RPC function for both logged-in and anonymous users
   * @param team - Required for anonymous users, optional for logged-in users
   */
  async extendSeries(sessionId: string, team?: 'team1' | 'team2'): Promise<void> {
    if (!supabase) throw new Error('Supabase not initialized');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rpcResult, error: rpcError } = await (supabase.rpc as any)('extend_live_draft_series', {
      p_session_id: sessionId,
      p_team: team ?? null,
    });

    if (rpcError) throw rpcError;
    if (!rpcResult?.success) {
      throw new Error(rpcResult?.message || 'Failed to extend series');
    }
  },

  /**
   * Leave captain role (let someone else take over)
   * Uses RPC function (SECURITY DEFINER) to bypass RLS for both logged-in and anonymous users
   * @param team - Required for anonymous users, optional for logged-in users
   */
  async leaveCaptainRole(sessionId: string, team?: 'team1' | 'team2'): Promise<void> {
    if (!supabase) throw new Error('Supabase not initialized');

    // Use RPC function which has SECURITY DEFINER to bypass RLS
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rpcResult, error: rpcError } = await (supabase.rpc as any)('leave_live_draft_captain_role', {
      p_session_id: sessionId,
      p_team: team ?? null,
    });

    if (rpcError) throw rpcError;
    if (!rpcResult?.success) {
      throw new Error(rpcResult?.message || 'Failed to leave captain role');
    }

    // Clean up localStorage for anonymous users
    try {
      localStorage.removeItem(`live_draft_anon_id_${sessionId}`);
      localStorage.removeItem(`live_draft_participant_${sessionId}`);
    } catch {
      // Ignore localStorage errors
    }
  },

  /**
   * Join session as controller (captain) - DEPRECATED, use joinAsTeamCaptain
   * Kept for backwards compatibility
   */
  async joinAsController(
    sessionId: string,
    displayName: string
  ): Promise<JoinSessionResult> {
    if (!displayName?.trim()) throw new Error('Display name is required');

    // Try to join as team2 if team1 is taken
    const session = await this.getSession(sessionId);
    if (!session) throw new Error('Session not found');

    if (!session.team1_captain_id && !session.team1_captain_display_name) {
      return this.joinAsTeamCaptain(sessionId, 'team1', displayName);
    } else if (!session.team2_captain_id && !session.team2_captain_display_name) {
      return this.joinAsTeamCaptain(sessionId, 'team2', displayName);
    } else {
      throw new Error('Both team captain slots are taken');
    }
  },

  /**
   * Join session as spectator
   * Supports both logged-in and anonymous users
   */
  async joinAsSpectator(sessionId: string, displayName?: string): Promise<JoinSessionResult> {
    if (!supabase) throw new Error('Supabase not initialized');

    const { data: { session: authSession } } = await supabase.auth.getSession();
    const userId = authSession?.user?.id ?? null;

    let participantData!: DbLiveDraftParticipant;

    if (userId) {
      // For logged-in users, use the RPC function
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)('join_live_draft_as_spectator', {
        p_session_id: sessionId,
        p_display_name: displayName ?? null,
      });

      if (error) throw error;
      participantData = data as DbLiveDraftParticipant;
    } else {
      // For anonymous users, handle directly without RPC
      // Check if we have an existing participant ID from localStorage
      let existingParticipantId: string | null = null;
      try {
        existingParticipantId = localStorage.getItem(`live_draft_participant_${sessionId}`);
      } catch {
        // Ignore localStorage errors
      }

      let insertNew = true;

      // If we have an existing participant, try to update it
      if (existingParticipantId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase
          .from('live_draft_participants') as any)
          .update({
            participant_type: 'spectator',
            team: null,
            is_captain: false,
            is_connected: true,
            last_seen_at: new Date().toISOString(),
          })
          .eq('id', existingParticipantId)
          .select()
          .single();

        if (!error && data) {
          participantData = data as DbLiveDraftParticipant;
          insertNew = false;
        }
        // If update fails (participant deleted), fall through to insert
      }

      // Insert new participant if no existing one
      if (insertNew) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase
          .from('live_draft_participants') as any)
          .insert({
            session_id: sessionId,
            user_id: null,
            participant_type: 'spectator',
            team: null,
            display_name: displayName ?? null,
            is_captain: false,
            is_connected: true,
          })
          .select()
          .single();

        if (error) throw error;
        participantData = data as DbLiveDraftParticipant;

        // Store participant ID in localStorage for reconnection
        try {
          localStorage.setItem(`live_draft_participant_${sessionId}`, participantData.id);
        } catch {
          // Ignore localStorage errors
        }
      }
    }

    const session = await this.getSession(sessionId);
    if (!session) throw new Error('Session not found');

    return {
      session,
      participant: mapParticipant(participantData),
      isSpectator: true,
    };
  },

  /**
   * Get all participants for a session
   */
  async getParticipants(sessionId: string): Promise<LiveDraftParticipant[]> {
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('live_draft_participants')
      .select(
        `
        *,
        profile:profiles(display_name, avatar_url, role, role_team_id, role_team:my_teams!profiles_role_team_id_fkey(name))
      `
      )
      .eq('session_id', sessionId);

    if (error) throw error;

    return (data || []).map((row) => {
      const participant = mapParticipant(row as DbLiveDraftParticipant);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((row as any).profile) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        participant.profile = (row as any).profile;
      }
      return participant;
    });
  },

  /**
   * Update connection status
   */
  async updateConnectionStatus(sessionId: string, isConnected: boolean): Promise<void> {
    if (!supabase) return;

    const { error } = await supabase.rpc('update_live_draft_connection', {
      p_session_id: sessionId,
      p_is_connected: isConnected,
    });

    if (error) throw error;
  },

  /**
   * Leave session
   * Supports both logged-in and anonymous users
   */
  async leaveSession(sessionId: string): Promise<void> {
    if (!supabase) return;

    const { data: { session: authSession } } = await supabase.auth.getSession();

    if (authSession?.user) {
      // For logged-in users, delete by user_id
      const { error } = await supabase
        .from('live_draft_participants')
        .delete()
        .eq('session_id', sessionId)
        .eq('user_id', authSession.user.id);

      if (error) throw error;
    } else {
      // For anonymous users, delete by stored participant ID
      try {
        const participantId = localStorage.getItem(`live_draft_participant_${sessionId}`);
        if (participantId) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error } = await (supabase
            .from('live_draft_participants') as any)
            .delete()
            .eq('id', participantId);

          if (error) throw error;

          // Clean up localStorage
          localStorage.removeItem(`live_draft_participant_${sessionId}`);
        }
      } catch {
        // Ignore localStorage errors
      }
    }
  },

  /**
   * Link an anonymous participant record to an authenticated user.
   * Called when a user logs in while on a live draft page where they
   * were previously participating anonymously.
   */
  async linkAnonymousParticipant(
    sessionId: string,
    participantId: string,
    userId: string
  ): Promise<boolean> {
    if (!supabase) return false;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('link_anonymous_draft_participant', {
      p_session_id: sessionId,
      p_participant_id: participantId,
      p_user_id: userId,
    });

    if (error) {
      console.warn('Failed to link anonymous participant:', error);
      return false;
    }

    return data?.success === true;
  },

  // ==========================================
  // DRAFT ACTIONS
  // ==========================================

  /**
   * Submit a ban or pick action.
   * The RPC handles recording the action AND advancing the game atomically.
   */
  async submitAction(gameId: string, championId: string | null): Promise<void> {
    if (!supabase) return;

    const { error } = await supabase.rpc('submit_draft_action', {
      p_game_id: gameId,
      p_champion_id: championId,
    });

    if (error) throw error;
  },

  /**
   * Fill a timed-out slot with a real champion.
   * Updates game arrays, action record, and fearless/ironman tracking.
   */
  async fillTimedOutSlot(
    gameId: string,
    slot: string,
    championId: string
  ): Promise<void> {
    if (!supabase) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.rpc as any)('fill_timed_out_slot', {
      p_game_id: gameId,
      p_slot: slot,
      p_champion_id: championId,
    });

    if (error) throw error;
  },

  /**
   * Edit a pick after draft (for gray picks)
   */
  async editPick(
    gameId: string,
    slot: string,
    championId: string
  ): Promise<void> {
    if (!supabase) return;

    const game = await this.getGame(gameId);
    if (!game) throw new Error('Game not found');

    // Parse slot (e.g., "blue_pick_3" -> { side: "blue", type: "pick", index: 3 })
    const [side, type, indexStr] = slot.split('_');
    const index = parseInt(indexStr, 10);

    // Get current array and edit
    const arrayKey = `${side}_${type}s` as 'blue_picks' | 'red_picks' | 'blue_bans' | 'red_bans';
    const currentArray = [...game[arrayKey]];
    const original = currentArray[index];
    currentArray[index] = championId;

    // Add to edited_picks
    const editedPicks = [
      ...game.edited_picks,
      {
        slot,
        original,
        edited: championId,
        at: new Date().toISOString(),
      },
    ];

    const { error } = await supabase
      .from('live_draft_games')
      .update({
        [arrayKey]: currentArray,
        edited_picks: editedPicks,
      })
      .eq('id', gameId);

    if (error) throw error;
  },

  // ==========================================
  // UNAVAILABLE CHAMPIONS
  // ==========================================

  /**
   * Get unavailable champions for a session
   */
  async getUnavailableChampions(
    sessionId: string
  ): Promise<DbLiveDraftUnavailableChampion[]> {
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('live_draft_unavailable_champions')
      .select('*')
      .eq('session_id', sessionId);

    if (error) throw error;
    return data || [];
  },

  /**
   * Mark champion as unavailable (for Fearless/Ironman)
   */
  async markChampionUnavailable(
    sessionId: string,
    championId: string,
    fromGame: number,
    reason: 'picked' | 'banned',
    team: DraftSide | null
  ): Promise<void> {
    if (!supabase) return;

    const { error } = await supabase.from('live_draft_unavailable_champions').insert({
      session_id: sessionId,
      champion_id: championId,
      from_game: fromGame,
      reason,
      team,
    });

    if (error && error.code !== '23505') {
      // Ignore duplicate key error
      throw error;
    }
  },

  // ==========================================
  // MESSAGES
  // ==========================================

  /**
   * Send a message in the session chat
   */
  async sendMessage(sessionId: string, content: string): Promise<LiveDraftMessage> {
    if (!supabase) throw new Error('Supabase not initialized');
    if (!content?.trim()) throw new Error('Message cannot be empty');
    if (content.trim().length > 500) throw new Error('Message must be 500 characters or less');

    // Moderate chat message content
    const modResult = await checkModerationAndRecord(content.trim(), 'live_draft_chat');
    if (modResult.flagged) throw new Error(getViolationWarning(modResult));

    // Check message cap before sending
    const { count } = await supabase
      .from('live_draft_messages')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', sessionId);

    if (count !== null && count >= CHAT_MESSAGE_CAP) {
      throw new Error(`Message limit reached (${CHAT_MESSAGE_CAP} per draft)`);
    }

    const { data: { session: authSession } } = await supabase.auth.getSession();

    // Get display name
    let displayName = 'Anonymous';
    if (authSession?.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', authSession.user.id)
        .single();

      displayName = profile?.display_name || 'Anonymous';
    }

    const { data, error } = await supabase
      .from('live_draft_messages')
      .insert({
        session_id: sessionId,
        user_id: authSession?.user?.id ?? null,
        display_name: displayName,
        content,
      })
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new Error('Failed to send message');

    return mapMessage(data as DbLiveDraftMessage);
  },

  /**
   * Get messages for a session
   */
  async getMessages(sessionId: string): Promise<LiveDraftMessage[]> {
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('live_draft_messages')
      .select(
        `
        *,
        profile:profiles(avatar_url)
      `
      )
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return (data || []).map((row) => {
      const message = mapMessage(row as DbLiveDraftMessage);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((row as any).profile) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        message.profile = (row as any).profile;
      }
      return message;
    });
  },

  // ==========================================
  // INVITES
  // ==========================================

  async sendDraftInvite(
    sessionId: string,
    username: string
  ): Promise<{ success: boolean; error?: string; targetUser?: { id: string; displayName: string; avatarUrl: string | null } }> {
    if (!supabase) throw new Error('Supabase not initialized');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('send_draft_invite', {
      p_session_id: sessionId,
      p_username: username.trim(),
    });

    if (error) throw error;

    return data as { success: boolean; error?: string; targetUser?: { id: string; displayName: string; avatarUrl: string | null } };
  },

  // ==========================================
  // URL HELPERS
  // ==========================================

  /**
   * Generate session URL (single link for everyone)
   */
  getSessionUrl(token: string): string {
    return `${window.location.origin}/live-draft/join/${token}`;
  },

  /**
   * Copy URL to clipboard
   */
  async copyToClipboard(url: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(url);
      return true;
    } catch {
      return false;
    }
  },
};
