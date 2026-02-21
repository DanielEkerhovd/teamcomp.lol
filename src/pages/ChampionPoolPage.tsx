import { useState } from 'react';
import { useMyTeamStore } from '../stores/useMyTeamStore';
import { usePlayerPoolStore } from '../stores/usePlayerPoolStore';
import { PlayerTierList } from '../components/champion';
import { Card } from '../components/ui';
import { ROLES, Role, Player } from '../types';

const ROLE_ICON_URLS: Record<Role, string> = {
  top: 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-top.png',
  jungle: 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-jungle.png',
  mid: 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-middle.png',
  adc: 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-bottom.png',
  support: 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-utility.png',
};

function RoleIcon({ role, className = 'w-4 h-4' }: { role: Role; className?: string }) {
  return (
    <img src={ROLE_ICON_URLS[role]} alt={role} className={`${className} object-contain`} />
  );
}

// Inline form shown when a role slot has no player assigned yet
function AddPlayerInline({ player, onSave }: { player: Player; onSave: (name: string, tag: string) => void }) {
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');

  const handleSave = () => {
    if (name.trim()) onSave(name.trim(), tag.trim());
  };

  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <p className="text-gray-500 text-sm">
        No player assigned to{' '}
        <span className="text-white capitalize">{ROLES.find(r => r.value === player.role)?.label}</span>.
        Add one to start building their pool.
      </p>
      <div className="flex gap-2 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            placeholder="Summoner name"
            autoFocus
            className="px-3 py-2 bg-lol-dark border border-lol-border rounded text-white placeholder-gray-500 text-sm focus:outline-none focus:border-lol-gold"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Tag</label>
          <input
            type="text"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            placeholder="EUW"
            className="w-24 px-3 py-2 bg-lol-dark border border-lol-border rounded text-white placeholder-gray-500 text-sm focus:outline-none focus:border-lol-gold"
          />
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={!name.trim()}
          className="px-4 py-2 rounded bg-lol-gold text-lol-dark font-medium text-sm hover:bg-lol-gold/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Add
        </button>
      </div>
    </div>
  );
}

export default function ChampionPoolPage() {
  const { teams, selectedTeamId, updatePlayer } = useMyTeamStore();
  const {
    findPool,
    getOrCreatePool,
    addChampionToGroup,
    removeChampionFromGroup,
    moveChampion,
    reorderChampionInGroup,
    addGroup,
    removeGroup,
    renameGroup,
    reorderGroups,
  } = usePlayerPoolStore();

  const team = teams.find((t) => t.id === selectedTeamId) || teams[0];

  // Sort main players by role order; collect subs separately
  const roleOrder = ROLES.map((r) => r.value);
  const mainPlayers = (team?.players ?? [])
    .filter((p) => !p.isSub)
    .sort((a, b) => roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role));
  const subs = (team?.players ?? []).filter((p) => p.isSub);

  const allPlayers = [...mainPlayers, ...subs];

  const [selectedPlayerId, setSelectedPlayerId] = useState<string>(
    allPlayers[0]?.id ?? ''
  );

  const selectedPlayer = allPlayers.find((p) => p.id === selectedPlayerId) ?? allPlayers[0];

  // Find the pool for the selected player (null if player has no name yet)
  const pool = selectedPlayer?.summonerName
    ? findPool(selectedPlayer.summonerName, selectedPlayer.role)
    : null;

  // When pool operations are triggered, ensure the pool exists first
  const resolvePool = () => {
    if (!selectedPlayer?.summonerName) return null;
    return getOrCreatePool(selectedPlayer.summonerName, selectedPlayer.tagLine, selectedPlayer.role);
  };

  const withPool = <T,>(fn: (poolId: string) => T): T | undefined => {
    const p = resolvePool();
    if (!p) return undefined;
    return fn(p.id);
  };

  const tabClass = (active: boolean) =>
    `w-full px-3 py-2.5 rounded-lg font-medium transition-all duration-200 text-left ${
      active
        ? 'bg-gradient-to-b from-lol-gold-light to-lol-gold text-lol-dark shadow-md'
        : 'text-gray-400 hover:text-white hover:bg-lol-surface'
    }`;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Champion Pool</h1>
        <p className="text-gray-400 mt-1">Manage champion pools per player</p>
      </div>

      <div className="flex gap-6 items-start">
        {/* Left sidebar: role tabs */}
        <div className="w-44 shrink-0 space-y-3">
          {/* Main roster */}
          {mainPlayers.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 px-1">
                Roster
              </p>
              <div className="flex flex-col gap-1">
                {mainPlayers.map((player) => {
                  const active = player.id === selectedPlayer?.id;
                  const isEmpty = !player.summonerName;
                  const champCount = pool && player.id === selectedPlayer?.id
                    ? pool.championGroups.reduce((n, g) => n + g.championIds.length, 0)
                    : 0;
                  return (
                    <button
                      key={player.id}
                      onClick={() => setSelectedPlayerId(player.id)}
                      className={tabClass(active)}
                    >
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <RoleIcon role={player.role} className="w-3.5 h-3.5" />
                        <span className={`text-xs ${active ? 'text-lol-dark/70' : 'text-gray-500'}`}>
                          {ROLES.find(r => r.value === player.role)?.label}
                        </span>
                      </div>
                      <div className={`text-sm font-semibold truncate ${isEmpty ? 'italic opacity-50' : ''}`}>
                        {isEmpty ? 'Empty' : player.summonerName}
                      </div>
                      {!isEmpty && champCount > 0 && (
                        <div className={`text-xs ${active ? 'text-lol-dark/60' : 'text-gray-500'}`}>
                          {champCount} champ{champCount !== 1 ? 's' : ''}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Subs */}
          {subs.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 px-1">
                Subs
              </p>
              <div className="flex flex-col gap-1">
                {subs.map((player) => {
                  const active = player.id === selectedPlayer?.id;
                  const isEmpty = !player.summonerName;
                  return (
                    <button
                      key={player.id}
                      onClick={() => setSelectedPlayerId(player.id)}
                      className={tabClass(active)}
                    >
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <RoleIcon role={player.role} className="w-3.5 h-3.5" />
                        <span className={`text-[10px] font-semibold ${active ? 'text-lol-dark/70' : 'text-orange-400'}`}>
                          SUB
                        </span>
                      </div>
                      <div className={`text-sm font-semibold truncate ${isEmpty ? 'italic opacity-50' : ''}`}>
                        {isEmpty ? 'Empty' : player.summonerName}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {!selectedPlayer ? (
            <Card className="text-center py-12">
              <p className="text-gray-400">No players in team yet. Add players on the My Team page.</p>
            </Card>
          ) : !selectedPlayer.summonerName ? (
            // Empty slot: let user add the player inline
            <Card variant="bordered" padding="lg">
              <AddPlayerInline
                player={selectedPlayer}
                onSave={(name, tag) =>
                  updatePlayer(selectedPlayer.id, { summonerName: name, tagLine: tag })
                }
              />
            </Card>
          ) : (
            <>
              {/* Player header */}
              <div className="flex items-center gap-3 mb-4">
                <RoleIcon role={selectedPlayer.role} className="w-6 h-6" />
                <div>
                  <h2 className="text-lg font-bold text-white leading-tight">
                    {selectedPlayer.summonerName}
                    {selectedPlayer.tagLine && (
                      <span className="text-gray-500 font-normal text-sm ml-1">
                        #{selectedPlayer.tagLine}
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-gray-500">
                    {ROLES.find(r => r.value === selectedPlayer.role)?.label}
                    {selectedPlayer.isSub && ' · Sub'}
                    {pool
                      ? ` · ${pool.championGroups.reduce((n, g) => n + g.championIds.length, 0)} champions`
                      : ' · no pool yet'}
                  </p>
                </div>
              </div>

              <Card variant="bordered" padding="lg">
                <PlayerTierList
                  player={{
                    role: selectedPlayer.role,
                    championGroups: pool?.championGroups ?? [],
                  }}
                  onAddChampion={(groupId, championId) =>
                    withPool((id) => addChampionToGroup(id, groupId, championId))
                  }
                  onRemoveChampion={(groupId, championId) =>
                    withPool((id) => removeChampionFromGroup(id, groupId, championId))
                  }
                  onMoveChampion={(fromGroupId, toGroupId, championId, newIndex) =>
                    withPool((id) => moveChampion(id, fromGroupId, toGroupId, championId, newIndex))
                  }
                  onReorderChampion={(groupId, championId, newIndex) =>
                    withPool((id) => reorderChampionInGroup(id, groupId, championId, newIndex))
                  }
                  onAddGroup={(groupName) =>
                    withPool((id) => addGroup(id, groupName))
                  }
                  onRemoveGroup={(groupId) =>
                    withPool((id) => removeGroup(id, groupId))
                  }
                  onRenameGroup={(groupId, newName) =>
                    withPool((id) => renameGroup(id, groupId, newName))
                  }
                  onReorderGroups={(groupIds) =>
                    withPool((id) => reorderGroups(id, groupIds))
                  }
                />
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
