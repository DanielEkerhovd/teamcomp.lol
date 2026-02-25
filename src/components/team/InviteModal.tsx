import { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import { teamMembershipService, TeamInvite } from '../../lib/teamMembershipService';
import type { Player } from '../../types';

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamId: string;
  teamName: string;
  players: Player[];
}

export default function InviteModal({ isOpen, onClose, teamId, teamName, players }: InviteModalProps) {
  const [invites, setInvites] = useState<TeamInvite[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // New invite form state
  const [newRole, setNewRole] = useState<'admin' | 'player' | 'viewer'>('player');
  const [newPlayerSlotId, setNewPlayerSlotId] = useState<string>('');
  const [newCanEditGroups, setNewCanEditGroups] = useState(false);
  const [newEmail, setNewEmail] = useState('');

  // Load existing invites when modal opens
  useEffect(() => {
    if (isOpen) {
      loadInvites();
    }
  }, [isOpen, teamId]);

  const loadInvites = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await teamMembershipService.getPendingInvites(teamId);
      setInvites(result);
    } catch (err) {
      setError('Failed to load invites');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInvite = async () => {
    setCreating(true);
    setError(null);
    try {
      const newInvite = await teamMembershipService.createInvite(
        teamId,
        newRole,
        {
          playerSlotId: newPlayerSlotId || undefined,
          canEditGroups: newCanEditGroups,
          email: newEmail || undefined,
        }
      );
      setInvites([newInvite, ...invites]);
      // Auto-copy the new invite link
      handleCopy(newInvite.token);
      // Reset form
      setNewEmail('');
      setNewPlayerSlotId('');
      setNewCanEditGroups(false);
    } catch (err) {
      setError('Failed to create invite');
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async (token: string) => {
    const success = await teamMembershipService.copyInviteUrl(token);
    if (success) {
      setCopiedId(token);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleRevoke = async (inviteId: string) => {
    try {
      await teamMembershipService.revokeInvite(inviteId);
      setInvites(invites.filter(i => i.id !== inviteId));
    } catch (err) {
      setError('Failed to revoke invite');
      console.error(err);
    }
  };

  // Get main players (not subs) for assignment
  const mainPlayers = players.filter(p => !p.isSub && p.summonerName);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Invite Team Members" size="md">
      <div className="space-y-4">
        {/* Header info */}
        <p className="text-gray-400 text-sm">
          Invite people to join <span className="text-white font-medium">{teamName}</span>.
          They can view all team data and edit their assigned champion pool.
        </p>

        {/* Error message */}
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Create new invite form */}
        <div className="space-y-3 p-4 bg-lol-surface rounded-xl border border-lol-border">
          <h3 className="text-sm font-medium text-gray-300">Create New Invite</h3>

          {/* Role selection */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Role</label>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setNewRole('admin');
                  setNewPlayerSlotId('');
                  setNewCanEditGroups(true);
                }}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  newRole === 'admin'
                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                    : 'bg-lol-card hover:bg-lol-border text-gray-400 border border-lol-border'
                }`}
              >
                Admin
              </button>
              <button
                onClick={() => setNewRole('player')}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  newRole === 'player'
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : 'bg-lol-card hover:bg-lol-border text-gray-400 border border-lol-border'
                }`}
              >
                Player
              </button>
              <button
                onClick={() => {
                  setNewRole('viewer');
                  setNewPlayerSlotId('');
                  setNewCanEditGroups(false);
                }}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  newRole === 'viewer'
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    : 'bg-lol-card hover:bg-lol-border text-gray-400 border border-lol-border'
                }`}
              >
                Viewer
              </button>
            </div>
            <p className="text-xs text-gray-600 mt-1">
              {newRole === 'admin' && 'Can manage team members and edit all players'}
              {newRole === 'player' && 'Can view team and edit assigned player slot'}
              {newRole === 'viewer' && 'Can only view team data'}
            </p>
          </div>

          {/* Player slot assignment (only for players) */}
          {newRole === 'player' && mainPlayers.length > 0 && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Assign to Player Slot (optional)</label>
              <select
                value={newPlayerSlotId}
                onChange={(e) => setNewPlayerSlotId(e.target.value)}
                className="w-full px-3 py-2 bg-lol-card border border-lol-border rounded-lg text-gray-300 text-sm focus:outline-none focus:border-lol-gold/50"
              >
                <option value="">No specific slot</option>
                {mainPlayers.map(player => (
                  <option key={player.id} value={player.id}>
                    {player.summonerName} ({player.role.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Can edit groups toggle (only for players) */}
          {newRole === 'player' && (
            <label className="flex items-center gap-3 p-3 bg-lol-card rounded-lg border border-lol-border cursor-pointer hover:border-lol-gold/30 transition-colors">
              <input
                type="checkbox"
                checked={newCanEditGroups}
                onChange={(e) => setNewCanEditGroups(e.target.checked)}
                className="w-4 h-4 rounded border-gray-500 text-lol-gold focus:ring-lol-gold/50 bg-lol-surface"
              />
              <div>
                <span className="text-sm text-gray-300">Can edit groups</span>
                <p className="text-xs text-gray-500">
                  Allow creating, renaming, and deleting champion groups
                </p>
              </div>
            </label>
          )}

          {/* Optional email */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Email (optional - for tracking)</label>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="teammate@example.com"
              className="w-full px-3 py-2 bg-lol-card border border-lol-border rounded-lg text-gray-300 text-sm placeholder:text-gray-600 focus:outline-none focus:border-lol-gold/50"
            />
          </div>

          {/* Create button */}
          <button
            onClick={handleCreateInvite}
            disabled={creating}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-lol-gold/10 hover:bg-lol-gold/20 border border-lol-gold/30 text-lol-gold rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {creating ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Creating...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                Create Invite Link
              </>
            )}
          </button>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-8">
            <svg className="animate-spin h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        )}

        {/* Pending invites */}
        {!loading && invites.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-400">Pending Invites</h3>
            {invites.map(invite => (
              <InviteLinkItem
                key={invite.id}
                invite={invite}
                players={players}
                copiedId={copiedId}
                onCopy={handleCopy}
                onRevoke={handleRevoke}
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && invites.length === 0 && (
          <div className="text-center py-4 text-gray-500 text-sm">
            No pending invites
          </div>
        )}
      </div>
    </Modal>
  );
}

interface InviteLinkItemProps {
  invite: TeamInvite;
  players: Player[];
  copiedId: string | null;
  onCopy: (token: string) => void;
  onRevoke: (id: string) => void;
}

function InviteLinkItem({ invite, players, copiedId, onCopy, onRevoke }: InviteLinkItemProps) {
  const inviteUrl = teamMembershipService.getInviteUrl(invite.token);
  const isCopied = copiedId === invite.token;
  const assignedPlayer = invite.playerSlotId ? players.find(p => p.id === invite.playerSlotId) : null;
  const expiresIn = Math.ceil((new Date(invite.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  return (
    <div className="flex items-center gap-2 p-3 bg-lol-surface rounded-lg border border-lol-border">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
            invite.role === 'admin'
              ? 'bg-purple-500/20 text-purple-400'
              : invite.role === 'player'
              ? 'bg-green-500/20 text-green-400'
              : 'bg-blue-500/20 text-blue-400'
          }`}>
            {invite.role}
          </span>
          {invite.canEditGroups && invite.role === 'player' && (
            <span className="text-xs text-gray-500">
              + groups
            </span>
          )}
          {assignedPlayer && (
            <span className="text-xs text-gray-500">
              {assignedPlayer.summonerName}
            </span>
          )}
          {invite.invitedEmail && (
            <span className="text-xs text-gray-500 truncate">
              {invite.invitedEmail}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1">
          <input
            type="text"
            readOnly
            value={inviteUrl}
            className="flex-1 bg-transparent text-xs text-gray-400 truncate focus:outline-none"
          />
        </div>
        <div className="text-xs text-gray-600 mt-0.5">
          Expires in {expiresIn} day{expiresIn !== 1 ? 's' : ''}
        </div>
      </div>
      <button
        onClick={() => onCopy(invite.token)}
        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
          isCopied
            ? 'bg-green-500/20 text-green-400'
            : 'bg-lol-gold/10 hover:bg-lol-gold/20 text-lol-gold'
        }`}
      >
        {isCopied ? 'Copied!' : 'Copy'}
      </button>
      <button
        onClick={() => onRevoke(invite.id)}
        className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
        title="Revoke invite"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
