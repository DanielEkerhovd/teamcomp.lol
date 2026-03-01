import { supabase } from './supabase';
import type { DbTeamMember, DbTeamInvite, InviteDetails } from '../types/database';
import type { Team } from '../types';

export type MemberRole = 'owner' | 'admin' | 'player' | 'viewer';

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  role: MemberRole;
  playerSlotId: string | null;
  canEditGroups: boolean;
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
  invitedUserId: string | null;
  role: 'admin' | 'player' | 'viewer';
  playerSlotId: string | null;
  canEditGroups: boolean;
  expiresAt: string;
  createdAt: string;
  acceptedAt: string | null;
  status: 'pending' | 'accepted' | 'declined';
}

export interface PendingTeamInvite {
  inviteId: string;
  teamId: string;
  teamName: string;
  role: 'admin' | 'player' | 'viewer';
  canEditGroups: boolean;
  playerSlotId: string | null;
  createdAt: string;
  expiresAt: string;
  invitedBy: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
}

export interface SentTeamInvite {
  inviteId: string;
  role: 'admin' | 'player' | 'viewer';
  canEditGroups: boolean;
  playerSlotId: string | null;
  createdAt: string;
  expiresAt: string;
  status: 'pending' | 'accepted' | 'declined';
  invitedUser: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  } | null;
  invitedEmail: string | null;
  token: string;
  isDirectInvite: boolean;
}

function mapTeamMember(row: DbTeamMember & { profiles?: { display_name: string | null; email: string | null; avatar_url: string | null } }): TeamMember {
  return {
    id: row.id,
    teamId: row.team_id,
    userId: row.user_id,
    role: row.role as MemberRole,
    playerSlotId: row.player_slot_id,
    canEditGroups: row.can_edit_groups,
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
    invitedUserId: row.invited_user_id || null,
    role: row.role,
    playerSlotId: row.player_slot_id,
    canEditGroups: row.can_edit_groups,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    acceptedAt: row.accepted_at,
    status: row.status || 'pending',
  };
}

export const teamMembershipService = {
  /**
   * Get all members of a team, including the owner
   */
  async getTeamMembers(teamId: string): Promise<TeamMember[]> {
    if (!supabase) return [];

    // Fetch team members (non-owners)
    const { data, error } = await (supabase
      .from('team_members' as 'profiles')
      .select(`
        *,
        profiles:user_id(display_name, email, avatar_url)
      `)
      .eq('team_id' as 'id', teamId) as unknown as Promise<{ data: (DbTeamMember & { profiles?: { display_name: string | null; email: string | null; avatar_url: string | null } })[] | null; error: Error | null }>);

    if (error) throw error;
    const members = (data || []).map(mapTeamMember);

    // Fetch team owner from my_teams
    const { data: teamData, error: teamError } = await supabase
      .from('my_teams')
      .select('user_id, profiles:user_id(display_name, email, avatar_url)')
      .eq('id', teamId)
      .single();

    if (!teamError && teamData) {
      const ownerProfile = (teamData as unknown as { user_id: string; profiles: { display_name: string | null; email: string | null; avatar_url: string | null } | null });

      // Try to fetch owner_player_slot_id (column may not exist yet if migration hasn't run)
      let ownerSlotId: string | null = null;
      try {
        const { data: slotData } = await supabase
          .from('my_teams')
          .select('owner_player_slot_id')
          .eq('id', teamId)
          .single();
        ownerSlotId = (slotData as unknown as { owner_player_slot_id: string | null })?.owner_player_slot_id || null;
      } catch {
        // Column doesn't exist yet — ignore
      }

      const ownerMember: TeamMember = {
        id: `owner-${teamId}`,
        teamId,
        userId: ownerProfile.user_id,
        role: 'owner',
        playerSlotId: ownerSlotId,
        canEditGroups: true,
        joinedAt: '',
        invitedBy: null,
        user: ownerProfile.profiles ? {
          displayName: ownerProfile.profiles.display_name,
          email: ownerProfile.profiles.email,
          avatarUrl: ownerProfile.profiles.avatar_url,
        } : undefined,
      };
      // Put owner first
      members.unshift(ownerMember);
    }

    return members;
  },

  /**
   * Create an invite link for a team
   */
  async createInvite(
    teamId: string,
    role: 'admin' | 'player' | 'viewer',
    options: {
      playerSlotId?: string;
      canEditGroups?: boolean;
      email?: string;
    } = {}
  ): Promise<TeamInvite> {
    if (!supabase) throw new Error('Unable to connect. Please check your internet connection.');

    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error('Please sign in to create an invite');

    const { data, error } = await (supabase
      .from('team_invites' as 'profiles')
      .insert({
        team_id: teamId,
        role,
        player_slot_id: options.playerSlotId || null,
        can_edit_groups: options.canEditGroups || false,
        invited_email: options.email || null,
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
   * Returns full response including any free tier conflicts
   */
  async acceptInvite(token: string): Promise<{
    success: boolean;
    teamId?: string;
    membershipId?: string;
    teamName?: string;
    role?: string;
    error?: string;
    conflict?: 'free_tier_team_limit';
    existingTeamId?: string;
    existingTeamName?: string;
    inviteTeamId?: string;
    inviteTeamName?: string;
    inviteRole?: string;
  }> {
    if (!supabase) return { success: false, error: 'Unable to connect. Please check your internet connection.' };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('accept_team_invite', {
      invite_token: token,
    });

    if (error) {
      return { success: false, error: 'Could not accept invite. Please try again.' };
    }

    return data;
  },

  /**
   * Leave a team (for non-owners)
   */
  async leaveTeam(teamId: string): Promise<{ success: boolean; error?: string }> {
    if (!supabase) return { success: false, error: 'Unable to connect. Please check your internet connection.' };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('leave_team', {
      p_team_id: teamId,
    });

    if (error) {
      return { success: false, error: 'Could not leave team. Please try again.' };
    }

    return data;
  },

  /**
   * Assign a player slot to a team member
   */
  async assignPlayerSlot(
    membershipId: string,
    playerSlotId: string | null
  ): Promise<{ success: boolean; error?: string }> {
    if (!supabase) return { success: false, error: 'Unable to connect. Please check your internet connection.' };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('assign_player_slot', {
      p_membership_id: membershipId,
      p_player_slot_id: playerSlotId,
    });

    if (error) {
      return { success: false, error: 'Could not assign player slot. Please try again.' };
    }

    return data;
  },

  /**
   * Update member permissions (can_edit_groups)
   */
  async updateMemberPermissions(
    membershipId: string,
    canEditGroups: boolean
  ): Promise<{ success: boolean; error?: string }> {
    if (!supabase) return { success: false, error: 'Unable to connect. Please check your internet connection.' };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('update_member_permissions', {
      p_membership_id: membershipId,
      p_can_edit_groups: canEditGroups,
    });

    if (error) {
      return { success: false, error: 'Could not update permissions. Please try again.' };
    }

    return data;
  },

  /**
   * Get teams where the user is a member (not owner) with full details
   */
  async getTeamMemberships(): Promise<Array<{
    membershipId: string;
    teamId: string;
    teamName: string;
    role: MemberRole;
    canEditGroups: boolean;
    playerSlotId: string | null;
    joinedAt: string;
    ownerName: string;
    ownerAvatar: string | null;
  }>> {
    if (!supabase) return [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('get_team_memberships');

    if (error) {
      console.error('Error fetching team memberships:', error);
      return [];
    }

    return data || [];
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
   * Remove a member from a team.
   * Returns true if the member was actually deleted, false if RLS silently blocked it.
   */
  async removeMember(memberId: string): Promise<boolean> {
    if (!supabase) return false;

    const { data, error } = await (supabase
      .from('team_members' as 'profiles')
      .delete()
      .eq('id', memberId)
      .select('id') as unknown as Promise<{ data: { id: string }[] | null; error: Error | null }>);

    if (error) throw error;
    return (data && data.length > 0) || false;
  },

  /**
   * Update a member's role or assigned player slot.
   * Returns true if the row was actually updated, false if RLS silently blocked it.
   */
  async updateMember(
    memberId: string,
    updates: { role?: MemberRole; playerSlotId?: string | null }
  ): Promise<boolean> {
    if (!supabase) return false;

    const updateData: Record<string, unknown> = {};
    if (updates.role) updateData.role = updates.role;
    if (updates.playerSlotId !== undefined) updateData.player_slot_id = updates.playerSlotId;

    const { data, error } = await (supabase
      .from('team_members' as 'profiles')
      .update(updateData as never)
      .eq('id', memberId)
      .select('id') as unknown as Promise<{ data: { id: string }[] | null; error: Error | null }>);

    if (error) throw error;
    return (data && data.length > 0) || false;
  },

  /**
   * Update the owner's assigned player slot (stored on my_teams)
   */
  async updateOwnerSlot(
    teamId: string,
    playerSlotId: string | null
  ): Promise<void> {
    if (!supabase) return;

    const { error } = await supabase
      .from('my_teams')
      .update({ owner_player_slot_id: playerSlotId } as never)
      .eq('id', teamId);

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
   * Remove all members from a team (except owner) and return their user IDs
   * Used when deleting a team to notify all members
   */
  async removeAllTeamMembers(teamId: string): Promise<string[]> {
    if (!supabase) return [];

    // First get all member user IDs (excluding the owner who is deleting)
    const { data: members, error: fetchError } = await (supabase
      .from('team_members' as 'profiles')
      .select('user_id')
      .eq('team_id' as 'id', teamId) as unknown as Promise<{ data: { user_id: string }[] | null; error: Error | null }>);

    if (fetchError) {
      console.error('Error fetching team members:', fetchError);
      return [];
    }

    const userIds = (members || []).map(m => m.user_id);

    // Delete all team members
    const { error: deleteError } = await (supabase
      .from('team_members' as 'profiles')
      .delete()
      .eq('team_id' as 'id', teamId) as unknown as Promise<{ data: unknown; error: Error | null }>);

    if (deleteError) {
      console.error('Error removing team members:', deleteError);
    }

    // Also delete any pending invites for this team
    await (supabase
      .from('team_invites' as 'profiles')
      .delete()
      .eq('team_id' as 'id', teamId) as unknown as Promise<{ data: unknown; error: Error | null }>);

    return userIds;
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

  /**
   * Send a team invite by username or email
   */
  async sendTeamInvite(
    teamId: string,
    identifier: string,
    role: 'admin' | 'player' | 'viewer' = 'player',
    options: {
      playerSlotId?: string;
      canEditGroups?: boolean;
    } = {}
  ): Promise<{
    success: boolean;
    error?: string;
    inviteId?: string;
    targetUser?: {
      id: string;
      displayName: string;
      avatarUrl: string | null;
    };
  }> {
    if (!supabase) return { success: false, error: 'Unable to connect. Please check your internet connection.' };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('send_team_invite', {
      p_team_id: teamId,
      p_identifier: identifier.trim(),
      p_role: role,
      p_player_slot_id: options.playerSlotId || null,
      p_can_edit_groups: options.canEditGroups || false,
    });

    if (error) {
      console.error('Error sending team invite:', error);
      // Return user-friendly error message
      if (error.message?.includes('not found') || error.message?.includes('User not found')) {
        return { success: false, error: 'User not found. Please check the username or email.' };
      }
      if (error.message?.includes('already a member')) {
        return { success: false, error: 'This user is already a member of the team.' };
      }
      return { success: false, error: 'Could not send invite. Please try again.' };
    }

    return data;
  },

  /**
   * Respond to a team invite (accept/decline)
   */
  async respondToTeamInvite(
    inviteId: string,
    accept: boolean
  ): Promise<{
    success: boolean;
    error?: string;
    status?: 'accepted' | 'declined';
    membershipId?: string;
    teamId?: string;
    teamName?: string;
    role?: string;
    conflict?: 'free_tier_team_limit';
    existingTeamId?: string;
    existingTeamName?: string;
    inviteTeamId?: string;
    inviteTeamName?: string;
    inviteRole?: string;
  }> {
    if (!supabase) return { success: false, error: 'Unable to connect. Please check your internet connection.' };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('respond_to_team_invite', {
      p_invite_id: inviteId,
      p_accept: accept,
    });

    if (error) {
      console.error('Error responding to team invite:', error);
      return { success: false, error: 'Could not respond to invite. Please try again.' };
    }

    return data;
  },

  /**
   * Get pending team invites for the current user
   */
  async getPendingTeamInvitesForUser(): Promise<PendingTeamInvite[]> {
    if (!supabase) return [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('get_pending_team_invites');

    if (error) {
      console.error('Error fetching pending team invites:', error);
      return [];
    }

    return data || [];
  },

  /**
   * Get sent invites for a team (both direct and link-based)
   */
  async getSentTeamInvites(teamId: string): Promise<SentTeamInvite[]> {
    if (!supabase) return [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('get_sent_team_invites', {
      p_team_id: teamId,
    });

    if (error) {
      console.error('Error fetching sent team invites:', error);
      return [];
    }

    return data || [];
  },

  /**
   * Cancel a pending team invite
   */
  async cancelTeamInvite(inviteId: string): Promise<{ success: boolean; error?: string }> {
    if (!supabase) return { success: false, error: 'Unable to connect. Please check your internet connection.' };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('cancel_team_invite', {
      p_invite_id: inviteId,
    });

    if (error) {
      console.error('Error canceling team invite:', error);
      return { success: false, error: 'Could not cancel invite. Please try again.' };
    }

    return data;
  },

  /**
   * Fetch full team data (info + players) for a team the user is a member of.
   * Returns a Team object compatible with the store format.
   */
  async fetchTeamData(teamId: string): Promise<Team | null> {
    if (!supabase) return null;

    // Fetch team info and players in parallel
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [teamRes, playersRes] = await Promise.all([
      (supabase as any).from('my_teams').select('*').eq('id', teamId).single(),
      (supabase as any).from('players').select('*').eq('team_id', teamId).order('sort_order'),
    ]);

    if (teamRes.error || !teamRes.data) return null;

    const team = teamRes.data;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const players = (playersRes.data || []).map((p: any) => ({
      id: p.id,
      summonerName: p.summoner_name,
      tagLine: p.tag_line || '',
      role: p.role,
      notes: p.notes || '',
      region: p.region || 'euw',
      isSub: p.is_sub || false,
      championPool: p.champion_pool || [],
      championGroups: p.champion_groups || [],
    }));

    return {
      id: team.id,
      name: team.name,
      notes: team.notes || '',
      championPool: team.champion_pool || [],
      players,
      createdAt: new Date(team.created_at).getTime(),
      updatedAt: new Date(team.updated_at).getTime(),
    };
  },
};
