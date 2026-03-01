import { useState, useEffect, useCallback } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Select from '../ui/Select';
import { supabase } from '../../lib/supabase';
import { teamMembershipService, TeamMember } from '../../lib/teamMembershipService';
import { useMyTeamStore } from '../../stores/useMyTeamStore';

type PermLevel = 'admins' | 'players' | 'all';

interface TeamSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamId: string;
  teamName: string;
  permDrafts: PermLevel;
  permEnemyTeams: PermLevel;
  permPlayers: PermLevel;
}

const PERM_OPTIONS: { value: PermLevel; label: string }[] = [
  { value: 'admins', label: 'Owner & Admins' },
  { value: 'players', label: 'Owner, Admins & Players' },
  { value: 'all', label: 'All Members' },
];

function hasPermissionByDefault(permLevel: PermLevel, role: string): boolean {
  if (role === 'owner') return true;
  if (permLevel === 'all') return true;
  if (permLevel === 'players' && (role === 'admin' || role === 'player')) return true;
  if (permLevel === 'admins' && role === 'admin') return true;
  return false;
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  player: 'Player',
  viewer: 'Viewer',
};

export default function TeamSettingsModal({
  isOpen,
  onClose,
  teamId,
  teamName,
  permDrafts: initialPermDrafts,
  permEnemyTeams: initialPermEnemyTeams,
  permPlayers: initialPermPlayers,
}: TeamSettingsModalProps) {
  const [permDrafts, setPermDrafts] = useState<PermLevel>(initialPermDrafts);
  const [permEnemyTeams, setPermEnemyTeams] = useState<PermLevel>(initialPermEnemyTeams);
  const [permPlayers, setPermPlayers] = useState<PermLevel>(initialPermPlayers);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [memberGrants, setMemberGrants] = useState<Record<string, { grantDrafts: boolean; grantEnemyTeams: boolean; grantPlayers: boolean }>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setPermDrafts(initialPermDrafts);
      setPermEnemyTeams(initialPermEnemyTeams);
      setPermPlayers(initialPermPlayers);
      loadMembers();
    }
  }, [isOpen, teamId]);

  const loadMembers = useCallback(async () => {
    setLoading(true);
    try {
      const allMembers = await teamMembershipService.getTeamMembers(teamId);
      // Filter out the owner — they always have full access
      const nonOwnerMembers = allMembers.filter(m => m.role !== 'owner');
      setMembers(nonOwnerMembers);

      // Initialize grant states from current member data
      const grants: Record<string, { grantDrafts: boolean; grantEnemyTeams: boolean; grantPlayers: boolean }> = {};
      for (const m of nonOwnerMembers) {
        grants[m.id] = {
          grantDrafts: m.grantDrafts,
          grantEnemyTeams: m.grantEnemyTeams,
          grantPlayers: m.grantPlayers,
        };
      }
      setMemberGrants(grants);
    } catch (err) {
      console.error('Failed to load members:', err);
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  const toggleGrant = (memberId: string, field: 'grantDrafts' | 'grantEnemyTeams' | 'grantPlayers') => {
    setMemberGrants(prev => ({
      ...prev,
      [memberId]: {
        ...prev[memberId],
        [field]: !prev[memberId]?.[field],
      },
    }));
  };

  const handleSave = async () => {
    if (!supabase) return;
    setSaving(true);

    try {
      // Save general permissions
      const { error: teamError } = await supabase
        .from('my_teams')
        .update({
          perm_drafts: permDrafts,
          perm_enemy_teams: permEnemyTeams,
          perm_players: permPlayers,
        } as never)
        .eq('id', teamId);

      if (teamError) throw teamError;

      // Save member grant overrides
      const updates = members.map(m => {
        const grants = memberGrants[m.id];
        if (!grants) return null;
        // Only update if values changed
        if (
          grants.grantDrafts === m.grantDrafts &&
          grants.grantEnemyTeams === m.grantEnemyTeams &&
          grants.grantPlayers === m.grantPlayers
        ) return null;

        return supabase
          .from('team_members' as 'profiles')
          .update({
            grant_drafts: grants.grantDrafts,
            grant_enemy_teams: grants.grantEnemyTeams,
            grant_players: grants.grantPlayers,
          } as never)
          .eq('id' as 'id', m.id);
      }).filter(Boolean);

      await Promise.all(updates);

      // Update local team store state
      useMyTeamStore.setState(s => ({
        teams: s.teams.map(t => {
          if (t.id !== teamId) return t;
          return {
            ...t,
            permDrafts,
            permEnemyTeams,
            permPlayers,
          };
        }),
      }));

      onClose();
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setSaving(false);
    }
  };

  // Check if any member needs override options shown
  const anyMemberNeedsOverrides = members.some(m =>
    !hasPermissionByDefault(permDrafts, m.role) ||
    !hasPermissionByDefault(permEnemyTeams, m.role) ||
    !hasPermissionByDefault(permPlayers, m.role)
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`${teamName} — Settings`} size="lg">
      <div className="space-y-6">
        {/* General Permissions */}
        <div>
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">General Permissions</h3>
          <p className="text-xs text-gray-500 mb-4">Control which roles can manage each type of team content.</p>
          <div className="space-y-3">
            {[
              { label: 'Drafts', value: permDrafts, setter: setPermDrafts, description: 'Create, edit, and delete team draft sessions' },
              { label: 'Enemy Teams', value: permEnemyTeams, setter: setPermEnemyTeams, description: 'Create, edit, and delete team enemy teams' },
              { label: 'Players', value: permPlayers, setter: setPermPlayers, description: 'Edit team player information and champion pools' },
            ].map(({ label, value, setter, description }) => (
              <div key={label} className="flex items-center justify-between gap-4 bg-lol-dark/50 rounded-xl px-4 py-3 border border-lol-border/50">
                <div className="shrink-0">
                  <p className="text-sm font-medium text-white">{label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{description}</p>
                </div>
                <Select
                  value={value}
                  onChange={e => setter(e.target.value as PermLevel)}
                  options={PERM_OPTIONS}
                  size="sm"
                  className="w-56"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Member Overrides */}
        <div>
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Member Overrides</h3>
          <p className="text-xs text-gray-500 mb-4">Grant specific members additional access beyond the general settings above.</p>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-lol-gold/30 border-t-lol-gold rounded-full animate-spin" />
            </div>
          ) : members.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">No team members yet.</p>
          ) : !anyMemberNeedsOverrides ? (
            <p className="text-sm text-gray-500 text-center py-4">All members already have access based on the general settings.</p>
          ) : (
            <div className="border border-lol-border/50 rounded-xl overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-[1fr,80px,80px,80px] gap-2 px-4 py-2 bg-lol-dark/80 border-b border-lol-border/50">
                <span className="text-xs font-medium text-gray-500">Member</span>
                <span className="text-xs font-medium text-gray-500 text-center">Drafts</span>
                <span className="text-xs font-medium text-gray-500 text-center">Enemies</span>
                <span className="text-xs font-medium text-gray-500 text-center">Players</span>
              </div>

              {/* Rows */}
              {members.map(member => {
                const grants = memberGrants[member.id];
                if (!grants) return null;

                const hasDraftsByDefault = hasPermissionByDefault(permDrafts, member.role);
                const hasEnemiesByDefault = hasPermissionByDefault(permEnemyTeams, member.role);
                const hasPlayersByDefault = hasPermissionByDefault(permPlayers, member.role);

                // Skip members who already have all permissions by default
                if (hasDraftsByDefault && hasEnemiesByDefault && hasPlayersByDefault) return null;

                return (
                  <div
                    key={member.id}
                    className="grid grid-cols-[1fr,80px,80px,80px] gap-2 px-4 py-2.5 border-b border-lol-border/30 last:border-b-0 hover:bg-lol-dark/30"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {member.user?.avatarUrl ? (
                        <img src={member.user.avatarUrl} alt="" className="w-6 h-6 rounded-full shrink-0" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-lol-surface shrink-0" />
                      )}
                      <span className="text-sm text-white truncate">{member.user?.displayName || 'Unknown'}</span>
                      <span className="text-xs text-gray-500 shrink-0">{ROLE_LABELS[member.role]}</span>
                    </div>

                    {/* Drafts */}
                    <div className="flex items-center justify-center">
                      {hasDraftsByDefault ? (
                        <span className="text-xs text-gray-500">default</span>
                      ) : (
                        <input
                          type="checkbox"
                          checked={grants.grantDrafts}
                          onChange={() => toggleGrant(member.id, 'grantDrafts')}
                          className="w-4 h-4 rounded border-lol-border bg-lol-dark text-lol-gold focus:ring-lol-gold/50 cursor-pointer"
                        />
                      )}
                    </div>

                    {/* Enemy Teams */}
                    <div className="flex items-center justify-center">
                      {hasEnemiesByDefault ? (
                        <span className="text-xs text-gray-500">default</span>
                      ) : (
                        <input
                          type="checkbox"
                          checked={grants.grantEnemyTeams}
                          onChange={() => toggleGrant(member.id, 'grantEnemyTeams')}
                          className="w-4 h-4 rounded border-lol-border bg-lol-dark text-lol-gold focus:ring-lol-gold/50 cursor-pointer"
                        />
                      )}
                    </div>

                    {/* Players */}
                    <div className="flex items-center justify-center">
                      {hasPlayersByDefault ? (
                        <span className="text-xs text-gray-500">default</span>
                      ) : (
                        <input
                          type="checkbox"
                          checked={grants.grantPlayers}
                          onChange={() => toggleGrant(member.id, 'grantPlayers')}
                          className="w-4 h-4 rounded border-lol-border bg-lol-dark text-lol-gold focus:ring-lol-gold/50 cursor-pointer"
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2 border-t border-lol-border/50">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
