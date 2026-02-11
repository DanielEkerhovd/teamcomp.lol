import { useState } from 'react';
import { useMyTeamStore } from '../stores/useMyTeamStore';
import { PlayerTierList } from '../components/champion';
import { Card } from '../components/ui';
import { ROLES } from '../types';

export default function ChampionPoolPage() {
  const {
    teams,
    selectedTeamId,
    addChampionToGroup,
    removeChampionFromGroup,
    moveChampion,
    reorderChampionInGroup,
    addGroup,
    removeGroup,
    renameGroup,
    reorderGroups,
  } = useMyTeamStore();
  const team = teams.find((t) => t.id === selectedTeamId) || teams[0];
  const mainPlayers = (team?.players || [])
    .filter((p) => !p.isSub)
    .sort((a, b) => {
      const roleOrder = ROLES.map((r) => r.value);
      return roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role);
    });
  const subs = (team?.players || []).filter((p) => p.isSub);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(
    mainPlayers[0]?.id || null
  );

  const selectedPlayer = (team?.players || []).find((p) => p.id === selectedPlayerId);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Champion Pool</h1>
        <p className="text-gray-400 mt-1">Manage champion pools for your team</p>
      </div>

      {/* Player Selector Tabs */}
      <div className="flex flex-wrap gap-2">
        <div className="inline-flex gap-2 bg-lol-dark p-2 rounded-xl border border-lol-border">
          {mainPlayers.map((player) => {
            const roleLabel = ROLES.find((r) => r.value === player.role)?.label || player.role;
            const isSelected = player.id === selectedPlayerId;
            return (
              <button
                key={player.id}
                onClick={() => setSelectedPlayerId(player.id)}
                className={`px-5 py-3 rounded-lg font-medium transition-all duration-200 w-32 ${
                  isSelected
                    ? 'bg-gradient-to-b from-lol-gold-light to-lol-gold text-lol-dark shadow-md'
                    : 'text-gray-400 hover:text-white hover:bg-lol-surface'
                }`}
              >
                <div className="text-sm font-semibold">{roleLabel}</div>
                <div className={`text-xs mt-0.5 ${isSelected ? 'text-lol-dark/70' : 'text-gray-500'}`}>
                  {player.summonerName
                    ? player.summonerName.charAt(0).toUpperCase() + player.summonerName.slice(1)
                    : 'Empty'}{' '}
                </div>
              </button>
            );
          })}
        </div>
        {/* Subs Tabs */}
        {subs.length > 0 && (
          <div className="inline-flex gap-2 bg-lol-dark p-2 rounded-xl border border-lol-border/50">
            {subs.map((player) => {
              const isSelected = player.id === selectedPlayerId;
              const champCount = (player.championGroups || []).reduce((acc, g) => acc + g.championIds.length, 0);
              return (
                <button
                  key={player.id}
                  onClick={() => setSelectedPlayerId(player.id)}
                  className={`px-5 py-3 rounded-lg font-medium transition-all duration-200 w-32 ${
                    isSelected
                      ? 'bg-gradient-to-b from-lol-gold-light to-lol-gold text-lol-dark shadow-md'
                      : 'text-gray-400 hover:text-white hover:bg-lol-surface'
                  }`}
                >
                  <div className="text-sm font-semibold text-orange-400">Sub</div>
                  <div className={`text-xs mt-0.5 ${isSelected ? 'text-lol-dark/70' : 'text-gray-500'}`}>
                    {player.summonerName || 'Empty'} {champCount > 0 && `(${champCount})`}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Selected Player's Champion Groups */}
      {selectedPlayer ? (
        <Card variant="bordered" padding="lg">
          <PlayerTierList
            player={selectedPlayer}
            onAddChampion={(groupId, championId) => addChampionToGroup(selectedPlayer.id, groupId, championId)}
            onRemoveChampion={(groupId, championId) => removeChampionFromGroup(selectedPlayer.id, groupId, championId)}
            onMoveChampion={(fromGroupId, toGroupId, championId, newIndex) => moveChampion(selectedPlayer.id, fromGroupId, toGroupId, championId, newIndex)}
            onReorderChampion={(groupId, championId, newIndex) => reorderChampionInGroup(selectedPlayer.id, groupId, championId, newIndex)}
            onAddGroup={(groupName) => addGroup(selectedPlayer.id, groupName)}
            onRemoveGroup={(groupId) => removeGroup(selectedPlayer.id, groupId)}
            onRenameGroup={(groupId, newName) => renameGroup(selectedPlayer.id, groupId, newName)}
            onReorderGroups={(groupIds) => reorderGroups(selectedPlayer.id, groupIds)}
          />
        </Card>
      ) : (
        <Card className="text-center py-12">
          <p className="text-gray-400">Select a player to manage their champion pool</p>
        </Card>
      )}
    </div>
  );
}
