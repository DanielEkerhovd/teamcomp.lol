// Supabase database types
// These match the schema in supabase/schema.sql

export type UserTier = 'free' | 'paid' | 'supporter' | 'admin';

export type ProfileRole = 'team_owner' | 'head_coach' | 'coach' | 'analyst' | 'player' | 'groupie' | 'custom';

export type TeamMemberRole = 'owner' | 'admin' | 'player' | 'viewer';
export type FriendshipStatus = 'pending' | 'accepted' | 'blocked';
export type NotificationType =
  | 'team_invite'
  | 'team_member_joined'
  | 'team_member_left'
  | 'team_role_changed'
  | 'player_assignment'
  | 'friend_request'
  | 'friend_accepted'
  | 'message';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          display_name: string | null;
          avatar_url: string | null;
          tier: UserTier;
          max_teams: number;
          role: ProfileRole | null;
          role_team_id: string | null;
          role_custom: string | null;
          is_private: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
          tier?: UserTier;
          max_teams?: number;
          role?: ProfileRole | null;
          role_team_id?: string | null;
          role_custom?: string | null;
          is_private?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
          tier?: UserTier;
          max_teams?: number;
          role?: ProfileRole | null;
          role_team_id?: string | null;
          role_custom?: string | null;
          is_private?: boolean;
          updated_at?: string;
        };
      };
      user_settings: {
        Row: {
          user_id: string;
          default_region: string;
          has_completed_onboarding: boolean;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          default_region?: string;
          has_completed_onboarding?: boolean;
          updated_at?: string;
        };
        Update: {
          default_region?: string;
          has_completed_onboarding?: boolean;
          updated_at?: string;
        };
      };
      my_teams: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          notes: string;
          champion_pool: unknown;
          created_at: string;
          updated_at: string;
          sort_order: number;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          notes?: string;
          champion_pool?: unknown;
          created_at?: string;
          updated_at?: string;
          sort_order?: number;
        };
        Update: {
          name?: string;
          notes?: string;
          champion_pool?: unknown;
          updated_at?: string;
          sort_order?: number;
        };
      };
      players: {
        Row: {
          id: string;
          team_id: string;
          summoner_name: string;
          tag_line: string;
          role: string;
          notes: string;
          region: string;
          is_sub: boolean;
          champion_groups: unknown;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          summoner_name: string;
          tag_line?: string;
          role: string;
          notes?: string;
          region?: string;
          is_sub?: boolean;
          champion_groups?: unknown;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          summoner_name?: string;
          tag_line?: string;
          role?: string;
          notes?: string;
          region?: string;
          is_sub?: boolean;
          champion_groups?: unknown;
          sort_order?: number;
          updated_at?: string;
        };
      };
      enemy_teams: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          notes: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          notes?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          notes?: string;
          updated_at?: string;
        };
      };
      enemy_players: {
        Row: {
          id: string;
          team_id: string;
          summoner_name: string;
          tag_line: string;
          role: string;
          notes: string;
          region: string;
          is_sub: boolean;
          champion_groups: unknown;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          summoner_name: string;
          tag_line?: string;
          role: string;
          notes?: string;
          region?: string;
          is_sub?: boolean;
          champion_groups?: unknown;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          summoner_name?: string;
          tag_line?: string;
          role?: string;
          notes?: string;
          region?: string;
          is_sub?: boolean;
          champion_groups?: unknown;
          sort_order?: number;
          updated_at?: string;
        };
      };
      draft_sessions: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          enemy_team_id: string | null;
          my_team_id: string | null;
          ban_groups: unknown;
          priority_groups: unknown;
          notes: string;
          notepad: unknown;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          enemy_team_id?: string | null;
          my_team_id?: string | null;
          ban_groups?: unknown;
          priority_groups?: unknown;
          notes?: string;
          notepad?: unknown;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          enemy_team_id?: string | null;
          my_team_id?: string | null;
          ban_groups?: unknown;
          priority_groups?: unknown;
          notes?: string;
          notepad?: unknown;
          sort_order?: number;
          updated_at?: string;
        };
      };
      player_pools: {
        Row: {
          id: string;
          user_id: string;
          summoner_name: string;
          tag_line: string;
          role: string;
          champion_groups: unknown;
          allow_duplicate_champions: boolean;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          summoner_name: string;
          tag_line?: string;
          role: string;
          champion_groups?: unknown;
          allow_duplicate_champions?: boolean;
          updated_at?: string;
        };
        Update: {
          summoner_name?: string;
          tag_line?: string;
          role?: string;
          champion_groups?: unknown;
          allow_duplicate_champions?: boolean;
          updated_at?: string;
        };
      };
      custom_pools: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          champion_groups: unknown;
          allow_duplicate_champions: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          champion_groups?: unknown;
          allow_duplicate_champions?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          champion_groups?: unknown;
          allow_duplicate_champions?: boolean;
          sort_order?: number;
          updated_at?: string;
        };
      };
      custom_templates: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          groups: string[];
          allow_duplicates: boolean;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          groups?: string[];
          allow_duplicates?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          name?: string;
          groups?: string[];
          allow_duplicates?: boolean;
          sort_order?: number;
        };
      };
      draft_theory: {
        Row: {
          user_id: string;
          blue_bans: (string | null)[];
          blue_picks: (string | null)[];
          red_bans: (string | null)[];
          red_picks: (string | null)[];
          blue_team_name: string;
          red_team_name: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          blue_bans?: (string | null)[];
          blue_picks?: (string | null)[];
          red_bans?: (string | null)[];
          red_picks?: (string | null)[];
          blue_team_name?: string;
          red_team_name?: string;
          updated_at?: string;
        };
        Update: {
          blue_bans?: (string | null)[];
          blue_picks?: (string | null)[];
          red_bans?: (string | null)[];
          red_picks?: (string | null)[];
          blue_team_name?: string;
          red_team_name?: string;
          updated_at?: string;
        };
      };
      team_members: {
        Row: {
          id: string;
          team_id: string;
          user_id: string;
          role: TeamMemberRole;
          player_slot_id: string | null;
          invited_by: string | null;
          joined_at: string;
          can_edit_groups: boolean;
        };
        Insert: {
          id?: string;
          team_id: string;
          user_id: string;
          role?: TeamMemberRole;
          player_slot_id?: string | null;
          invited_by?: string | null;
          joined_at?: string;
          can_edit_groups?: boolean;
        };
        Update: {
          role?: TeamMemberRole;
          player_slot_id?: string | null;
          can_edit_groups?: boolean;
        };
      };
      team_invites: {
        Row: {
          id: string;
          team_id: string;
          token: string;
          invited_email: string | null;
          role: 'admin' | 'player' | 'viewer';
          player_slot_id: string | null;
          created_by: string;
          expires_at: string;
          accepted_at: string | null;
          accepted_by: string | null;
          created_at: string;
          can_edit_groups: boolean;
        };
        Insert: {
          id?: string;
          team_id: string;
          token?: string;
          invited_email?: string | null;
          role?: 'admin' | 'player' | 'viewer';
          player_slot_id?: string | null;
          created_by: string;
          expires_at?: string;
          accepted_at?: string | null;
          accepted_by?: string | null;
          created_at?: string;
          can_edit_groups?: boolean;
        };
        Update: {
          invited_email?: string | null;
          role?: 'admin' | 'player' | 'viewer';
          player_slot_id?: string | null;
          expires_at?: string;
          accepted_at?: string | null;
          accepted_by?: string | null;
          can_edit_groups?: boolean;
        };
      };
      draft_shares: {
        Row: {
          id: string;
          draft_session_id: string;
          token: string;
          created_by: string;
          is_active: boolean;
          view_count: number;
          last_viewed_at: string | null;
          expires_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          draft_session_id: string;
          token?: string;
          created_by: string;
          is_active?: boolean;
          view_count?: number;
          last_viewed_at?: string | null;
          expires_at?: string | null;
          created_at?: string;
        };
        Update: {
          is_active?: boolean;
          view_count?: number;
          last_viewed_at?: string | null;
          expires_at?: string | null;
        };
      };
      friendships: {
        Row: {
          id: string;
          user_id: string;
          friend_id: string;
          status: FriendshipStatus;
          created_at: string;
          accepted_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          friend_id: string;
          status?: FriendshipStatus;
          created_at?: string;
          accepted_at?: string | null;
        };
        Update: {
          status?: FriendshipStatus;
          accepted_at?: string | null;
        };
      };
      messages: {
        Row: {
          id: string;
          sender_id: string;
          recipient_id: string;
          content: string;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          sender_id: string;
          recipient_id: string;
          content: string;
          read_at?: string | null;
          created_at?: string;
        };
        Update: {
          read_at?: string | null;
        };
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: NotificationType;
          title: string;
          body: string | null;
          data: Record<string, unknown>;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: NotificationType;
          title: string;
          body?: string | null;
          data?: Record<string, unknown>;
          read_at?: string | null;
          created_at?: string;
        };
        Update: {
          read_at?: string | null;
        };
      };
    };
  };
}

// Helper types for easier usage
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type UserSettings = Database['public']['Tables']['user_settings']['Row'];
export type DbMyTeam = Database['public']['Tables']['my_teams']['Row'];
export type DbPlayer = Database['public']['Tables']['players']['Row'];
export type DbEnemyTeam = Database['public']['Tables']['enemy_teams']['Row'];
export type DbEnemyPlayer = Database['public']['Tables']['enemy_players']['Row'];
export type DbDraftSession = Database['public']['Tables']['draft_sessions']['Row'];
export type DbPlayerPool = Database['public']['Tables']['player_pools']['Row'];
export type DbCustomPool = Database['public']['Tables']['custom_pools']['Row'];
export type DbCustomTemplate = Database['public']['Tables']['custom_templates']['Row'];
export type DbDraftTheory = Database['public']['Tables']['draft_theory']['Row'];
export type DbTeamMember = Database['public']['Tables']['team_members']['Row'];
export type DbTeamInvite = Database['public']['Tables']['team_invites']['Row'];
export type DbDraftShare = Database['public']['Tables']['draft_shares']['Row'];
export type DbFriendship = Database['public']['Tables']['friendships']['Row'];
export type DbMessage = Database['public']['Tables']['messages']['Row'];
export type DbNotification = Database['public']['Tables']['notifications']['Row'];

// Types for RPC responses
export interface SharedDraftData {
  draft: DbDraftSession & { my_team_id?: string | null };
  enemyTeam: {
    team: DbEnemyTeam;
    players: DbEnemyPlayer[];
  } | null;
  myTeam: {
    team: DbMyTeam;
    players: DbPlayer[];
  } | null;
  shareInfo: {
    viewCount: number;
    createdAt: string;
  };
}

export interface InviteDetails {
  id: string;
  teamName: string;
  role: 'admin' | 'player' | 'viewer';
  canEditGroups: boolean;
  playerSlot: {
    id: string;
    summonerName: string;
    role: string;
  } | null;
  expiresAt: string;
  isExpired: boolean;
  isAccepted: boolean;
}

// Friend types
export interface Friend {
  friendshipId: string;
  friendId: string;
  displayName: string;
  avatarUrl: string | null;
  acceptedAt: string;
  role?: ProfileRole | null;
  roleCustom?: string | null;
  roleTeamName?: string | null;
}

export interface PendingFriendRequest {
  friendshipId: string;
  fromUserId?: string;
  toUserId?: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
  role?: ProfileRole | null;
  roleCustom?: string | null;
  roleTeamName?: string | null;
}

export interface BlockedUser {
  friendshipId: string;
  blockedUserId: string;
  displayName: string;
  avatarUrl: string | null;
  blockedAt: string;
}

export interface FriendsData {
  accepted: Friend[];
  pendingReceived: PendingFriendRequest[];
  pendingSent: PendingFriendRequest[];
  blocked: BlockedUser[];
}

// Message types
export interface ConversationPreview {
  friendId: string;
  friendName: string;
  friendAvatar: string | null;
  lastMessage: string;
  lastMessageAt: string;
  lastMessageBy: string;
  unreadCount: number;
}

export interface Message {
  id: string;
  senderId: string;
  recipientId: string;
  content: string;
  readAt: string | null;
  createdAt: string;
  senderName: string;
  senderAvatar: string | null;
}

// Team membership types
export interface TeamMembership {
  membershipId: string;
  teamId: string;
  teamName: string;
  role: TeamMemberRole;
  canEditGroups: boolean;
  playerSlotId: string | null;
  joinedAt: string;
  ownerName: string;
  ownerAvatar: string | null;
}

// Accept invite response
export interface AcceptInviteResponse {
  success: boolean;
  error?: string;
  conflict?: 'free_tier_team_limit';
  existingTeamId?: string;
  existingTeamName?: string;
  inviteTeamId?: string;
  inviteTeamName?: string;
  inviteRole?: string;
  membershipId?: string;
  teamId?: string;
  teamName?: string;
  role?: string;
}

// Friend request response
export interface FriendRequestResponse {
  success: boolean;
  error?: string;
  friendshipId?: string;
  message?: string;
  targetUser?: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
}

// Send message response
export interface SendMessageResponse {
  success: boolean;
  error?: string;
  messageId?: string;
  createdAt?: string;
}
