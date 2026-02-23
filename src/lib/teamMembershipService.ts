import { supabase } from './supabase';
import type { DbTeamMember, DbTeamInvite, InviteDetails } from '../types/database';

export type MemberRole = 'owner' | 'player' | 'viewer';

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  role: MemberRole;
  playerSlotId: string | null;
  joinedAt: string;
  invitedBy: string | null;
  user?: {
    displayName: string | null;
    email: string | null;
    avatarUrl: string | null;
  };
}

export interface TeamInvite {
  id: string;
  teamId: string;
  token: string;
  invitedEmail: string | null;
  role: 'player' | 'viewer';
  playerSlotId: string | null;
  expiresAt: string;
  createdAt: string;
  acceptedAt: string | null;
}

function mapTeamMember(row: DbTeamMember & { profiles?: { display_name: string | null; email: string | null; avatar_url: string | null } }): TeamMember {
  return {
    id: row.id,
    teamId: row.team_id,
    userId: row.user_id,
    role: row.role,
    playerSlotId: row.player_slot_id,
    joinedAt: row.joined_at,
    invitedBy: row.invited_by,
    user: row.profiles ? {
      displayName: row.profiles.display_name,
      email: row.profiles.email,
      avatarUrl: row.profiles.avatar_url,
    } : undefined,
  };
}

function mapTeamInvite(row: DbTeamInvite): TeamInvite {
  return {
    id: row.id,
    teamId: row.team_id,
    token: row.token,
    invitedEmail: row.invited_email,
    role: row.role,
    playerSlotId: row.player_slot_id,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    acceptedAt: row.accepted_at,
  };
}

export const teamMembershipService = {
  /**
   * Get all members of a team
   */
  async getTeamMembers(teamId: string): Promise<TeamMember[]> {
    if (!supabase) return [];

    const { data, error } = await (supabase
      .from('team_members' as 'profiles')
      .select(`
        *,
        profiles:user_id(display_name, email, avatar_url)
      `)
      .eq('team_id' as 'id', teamId) as unknown as Promise<{ data: (DbTeamMember & { profiles?: { display_name: string | null; email: string | null; avatar_url: string | null } })[] | null; error: Error | null }>);

    if (error) throw error;
    return (data || []).map(mapTeamMember);
  },

  /**
   * Create an invite link for a team
   */
  async createInvite(
    teamId: string,
    role: 'player' | 'viewer',
    playerSlotId?: string,
    email?: string
  ): Promise<TeamInvite> {
    if (!supabase) throw new Error('Supabase not configured');

    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error('Must be authenticated to create invite');

    const { data, error } = await (supabase
      .from('team_invites' as 'profiles')
      .insert({
        team_id: teamId,
        role,
        player_slot_id: playerSlotId || null,
        invited_email: email || null,
        created_by: user.user.id,
      } as never)
      .select()
      .single() as unknown as Promise<{ data: DbTeamInvite | null; error: Error | null }>);

    if (error) throw error;
    if (!data) throw new Error('Failed to create invite');
    return mapTeamInvite(data);
  },

  /**
   * Get pending (not accepted) invites for a team
   */
  async getPendingInvites(teamId: string): Promise<TeamInvite[]> {
    if (!supabase) return [];

    const { data, error } = await (supabase
      .from('team_invites' as 'profiles')
      .select('*')
      .eq('team_id' as 'id', teamId)
      .is('accepted_at' as 'id', null)
      .gt('expires_at' as 'id', new Date().toISOString())
      .order('created_at', { ascending: false }) as unknown as Promise<{ data: DbTeamInvite[] | null; error: Error | null }>);

    if (error) throw error;
    return (data || []).map(mapTeamInvite);
  },

  /**
   * Get invite details by token (public, for displaying invite page)
   */
  async getInviteDetails(token: string): Promise<InviteDetails | null> {
    if (!supabase) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('get_invite_details', {
      invite_token: token,
    });

    if (error) throw error;
    return data as InviteDetails | null;
  },

  /**
   * Accept an invite using the token
   */
  async acceptInvite(token: string): Promise<{ teamId: string; membershipId: string }> {
    if (!supabase) throw new Error('Supabase not configured');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('accept_team_invite', {
      invite_token: token,
    });

    if (error) throw error;
    return {
      teamId: data.teamId,
      membershipId: data.membershipId,
    };
  },

  /**
   * Revoke (delete) an invite
   */
  async revokeInvite(inviteId: string): Promise<void> {
    if (!supabase) return;

    const { error } = await (supabase
      .from('team_invites' as 'profiles')
      .delete()
      .eq('id', inviteId) as unknown as Promise<{ data: unknown; error: Error | null }>);

    if (error) throw error;
  },

  /**
   * Remove a member from a team
   */
  async removeMember(memberId: string): Promise<void> {
    if (!supabase) return;

    const { error } = await (supabase
      .from('team_members' as 'profiles')
      .delete()
      .eq('id', memberId) as unknown as Promise<{ data: unknown; error: Error | null }>);

    if (error) throw error;
  },

  /**
   * Update a member's role or assigned player slot
   */
  async updateMember(
    memberId: string,
    updates: { role?: MemberRole; playerSlotId?: string | null }
  ): Promise<void> {
    if (!supabase) return;

    const updateData: Record<string, unknown> = {};
    if (updates.role) updateData.role = updates.role;
    if (updates.playerSlotId !== undefined) updateData.player_slot_id = updates.playerSlotId;

    const { error } = await (supabase
      .from('team_members' as 'profiles')
      .update(updateData as never)
      .eq('id', memberId) as unknown as Promise<{ data: unknown; error: Error | null }>);

    if (error) throw error;
  },

  /**
   * Get all teams the current user is a member of
   */
  async getUserMemberships(): Promise<(TeamMember & { teamName?: string })[]> {
    if (!supabase) return [];

    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return [];

    const { data, error } = await (supabase
      .from('team_members' as 'profiles')
      .select(`
        *,
        my_teams:team_id(name)
      `)
      .eq('user_id' as 'id', user.user.id) as unknown as Promise<{ data: (DbTeamMember & { my_teams?: { name: string } })[] | null; error: Error | null }>);

    if (error) throw error;

    return (data || []).map((row) => ({
      ...mapTeamMember(row),
      teamName: row.my_teams?.name,
    }));
  },

  /**
   * Check if the current user can edit a specific player slot
   */
  async canEditPlayerSlot(playerId: string): Promise<boolean> {
    if (!supabase) return false;

    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return false;

    // Check if user is assigned to this player slot
    const { data } = await (supabase
      .from('team_members' as 'profiles')
      .select('id')
      .eq('user_id' as 'id', user.user.id)
      .eq('player_slot_id' as 'id', playerId)
      .single() as unknown as Promise<{ data: { id: string } | null; error: Error | null }>);

    return !!data;
  },

  /**
   * Check if the current user is the owner of a team
   */
  async isTeamOwner(teamId: string): Promise<boolean> {
    if (!supabase) return false;

    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return false;

    const { data } = await supabase
      .from('my_teams')
      .select('id')
      .eq('id', teamId)
      .eq('user_id', user.user.id)
      .single();

    return !!data;
  },

  /**
   * Generate the full invite URL for a token
   */
  getInviteUrl(token: string): string {
    return `${window.location.origin}/invite/${token}`;
  },

  /**
   * Copy invite URL to clipboard
   */
  async copyInviteUrl(token: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(this.getInviteUrl(token));
      return true;
    } catch {
      return false;
    }
  },
};
