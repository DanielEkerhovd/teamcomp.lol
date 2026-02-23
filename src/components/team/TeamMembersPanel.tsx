import { useState, useEffect } from 'react';
import { teamMembershipService, TeamMember, MemberRole } from '../../lib/teamMembershipService';
import InviteModal from './InviteModal';
import type { Player } from '../../types';

interface TeamMembersPanelProps {
  teamId: string;
  teamName: string;
  players: Player[];
  isOwner: boolean;
}

export default function TeamMembersPanel({ teamId, teamName, players, isOwner }: TeamMembersPanelProps) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  useEffect(() => {
    loadMembers();
  }, [teamId]);

  const loadMembers = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await teamMembershipService.getTeamMembers(teamId);
      setMembers(result);
    } catch (err) {
      setError('Failed to load team members');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this member from the team?')) {
      return;
    }
    try {
      await teamMembershipService.removeMember(memberId);
      setMembers(members.filter(m => m.id !== memberId));
    } catch (err) {
      setError('Failed to remove member');
      console.error(err);
    }
  };

  const handleUpdateRole = async (memberId: string, newRole: MemberRole) => {
    try {
      await teamMembershipService.updateMember(memberId, { role: newRole });
      setMembers(members.map(m => m.id === memberId ? { ...m, role: newRole } : m));
    } catch (err) {
      setError('Failed to update role');
      console.error(err);
    }
  };

  const handleUpdateSlot = async (memberId: string, playerSlotId: string | null) => {
    try {
      await teamMembershipService.updateMember(memberId, { playerSlotId });
      setMembers(members.map(m => m.id === memberId ? { ...m, playerSlotId } : m));
    } catch (err) {
      setError('Failed to update player slot');
      console.error(err);
    }
  };

  const getRoleBadgeClass = (role: MemberRole) => {
    switch (role) {
      case 'owner':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'player':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'viewer':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    }
  };

  // Get main players (not subs) for assignment
  const mainPlayers = players.filter(p => !p.isSub && p.summonerName);

  // Separate owner from other members
  const owner = members.find(m => m.role === 'owner');
  const otherMembers = members.filter(m => m.role !== 'owner');

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          Team Members
        </h3>
        {isOwner && (
          <button
            onClick={() => setIsInviteModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-lol-gold/10 hover:bg-lol-gold/20 border border-lol-gold/30 text-lol-gold rounded-lg text-sm font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            Invite
          </button>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <svg className="animate-spin h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
      )}

      {/* Members list */}
      {!loading && (
        <div className="space-y-2">
          {/* Owner (always first) */}
          {owner && (
            <MemberItem
              member={owner}
              players={players}
              mainPlayers={mainPlayers}
              isOwner={isOwner}
              canEdit={false}
              getRoleBadgeClass={getRoleBadgeClass}
              onRemove={handleRemoveMember}
              onUpdateRole={handleUpdateRole}
              onUpdateSlot={handleUpdateSlot}
            />
          )}

          {/* Other members */}
          {otherMembers.map(member => (
            <MemberItem
              key={member.id}
              member={member}
              players={players}
              mainPlayers={mainPlayers}
              isOwner={isOwner}
              canEdit={isOwner}
              getRoleBadgeClass={getRoleBadgeClass}
              onRemove={handleRemoveMember}
              onUpdateRole={handleUpdateRole}
              onUpdateSlot={handleUpdateSlot}
            />
          ))}

          {/* Empty state */}
          {members.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <p>No team members yet</p>
              {isOwner && (
                <p className="text-sm mt-1">Invite teammates to collaborate on this team</p>
              )}
            </div>
          )}

          {/* Only owner */}
          {members.length === 1 && owner && (
            <div className="text-center py-4 text-gray-500 text-sm">
              {isOwner ? "You're the only member. Invite teammates to collaborate!" : "No other members yet."}
            </div>
          )}
        </div>
      )}

      {/* Invite Modal */}
      <InviteModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        teamId={teamId}
        teamName={teamName}
        players={players}
      />
    </div>
  );
}

interface MemberItemProps {
  member: TeamMember;
  players: Player[];
  mainPlayers: Player[];
  isOwner: boolean;
  canEdit: boolean;
  getRoleBadgeClass: (role: MemberRole) => string;
  onRemove: (memberId: string) => void;
  onUpdateRole: (memberId: string, role: MemberRole) => void;
  onUpdateSlot: (memberId: string, playerSlotId: string | null) => void;
}

function MemberItem({
  member,
  players,
  mainPlayers,
  isOwner,
  canEdit,
  getRoleBadgeClass,
  onRemove,
  onUpdateRole,
  onUpdateSlot
}: MemberItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const assignedPlayer = member.playerSlotId ? players.find(p => p.id === member.playerSlotId) : null;

  const displayName = member.user?.displayName || member.user?.email || 'Unknown User';

  return (
    <div className="flex items-center gap-3 p-3 bg-lol-surface rounded-lg border border-lol-border">
      {/* Avatar */}
      <div className="w-10 h-10 rounded-full bg-lol-card flex items-center justify-center overflow-hidden">
        {member.user?.avatarUrl ? (
          <img src={member.user.avatarUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-white font-medium truncate">{displayName}</span>
          <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getRoleBadgeClass(member.role)}`}>
            {member.role}
          </span>
        </div>
        {assignedPlayer && (
          <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
            <span>Assigned to:</span>
            <span className="text-gray-400">{assignedPlayer.summonerName} ({assignedPlayer.role.toUpperCase()})</span>
          </div>
        )}
        {member.user?.email && member.user.displayName && (
          <div className="text-xs text-gray-600 truncate">{member.user.email}</div>
        )}
      </div>

      {/* Actions */}
      {canEdit && member.role !== 'owner' && (
        <div className="flex items-center gap-1">
          {isEditing ? (
            <>
              <select
                value={member.role}
                onChange={(e) => {
                  onUpdateRole(member.id, e.target.value as MemberRole);
                  if (e.target.value === 'viewer') {
                    onUpdateSlot(member.id, null);
                  }
                }}
                className="px-2 py-1 bg-lol-card border border-lol-border rounded text-xs text-gray-300 focus:outline-none"
              >
                <option value="player">Player</option>
                <option value="viewer">Viewer</option>
              </select>
              {member.role === 'player' && (
                <select
                  value={member.playerSlotId || ''}
                  onChange={(e) => onUpdateSlot(member.id, e.target.value || null)}
                  className="px-2 py-1 bg-lol-card border border-lol-border rounded text-xs text-gray-300 focus:outline-none"
                >
                  <option value="">No slot</option>
                  {mainPlayers.map(player => (
                    <option key={player.id} value={player.id}>
                      {player.summonerName}
                    </option>
                  ))}
                </select>
              )}
              <button
                onClick={() => setIsEditing(false)}
                className="p-1 text-green-400 hover:bg-green-500/10 rounded transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="p-1.5 text-gray-500 hover:text-gray-300 hover:bg-lol-border rounded transition-colors"
                title="Edit member"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
              <button
                onClick={() => onRemove(member.id)}
                className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                title="Remove member"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
