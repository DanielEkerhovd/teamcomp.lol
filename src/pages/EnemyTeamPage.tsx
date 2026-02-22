import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { useEnemyTeamStore } from '../stores/useEnemyTeamStore';
import { parseOpggMultiSearchUrl, ROLES, Role, Player } from '../types';
import { Button, Card, Input, Modal } from '../components/ui';
import { RoleSlot, SubSlot, OpggLinks } from '../components/team';
import { PlayerTierList } from '../components/champion';

function SubsDropZone({ children, teamId }: { children: React.ReactNode; teamId: string }) {
  const { isOver, setNodeRef } = useDroppable({
    id: `subs-drop-zone-${teamId}`,
    data: { type: 'subs', teamId },
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex gap-3 flex-wrap min-h-20 p-2 rounded-xl transition-all duration-200 ${
        isOver ? 'bg-lol-gold/10 ring-2 ring-lol-gold/50' : 'bg-lol-dark/50'
      }`}
    >
      {children}
    </div>
  );
}

export default function EnemyTeamPage() {
  const {
    teams,
    addTeam,
    importTeamFromOpgg,
    importPlayersToTeam,
    updateTeam,
    deleteTeam,
    updatePlayer,
    addSub,
    removeSub,
    swapPlayerRoles,
    moveToRole,
    moveToSubs,
    addChampionToGroup,
    removeChampionFromGroup,
    moveChampion,
    reorderChampionInGroup,
    addGroup,
    removeGroup,
    renameGroup,
    reorderGroups,
  } = useEnemyTeamStore();
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Record<string, string>>({});
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [importUrl, setImportUrl] = useState('');
  const [importTeamName, setImportTeamName] = useState('');
  const [importError, setImportError] = useState('');
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
  const [activePlayer, setActivePlayer] = useState<Player | null>(null);
  const [inlineImportUrl, setInlineImportUrl] = useState<Record<string, string>>({});
  const [inlineImportError, setInlineImportError] = useState<Record<string, string>>({});
  const [activeDragTeamId, setActiveDragTeamId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const handleDragStart = (event: DragStartEvent, teamId: string, players: Player[]) => {
    const { active } = event;
    const player = players.find((p) => p.id === active.id);
    setActivePlayer(player || null);
    setActiveDragTeamId(teamId);
  };

  const handleDragEnd = (event: DragEndEvent, teamId: string, players: Player[]) => {
    const { active, over } = event;
    setActivePlayer(null);
    setActiveDragTeamId(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    if (overId.startsWith('role-')) {
      const role = overId.replace('role-', '') as Role;
      moveToRole(teamId, activeId, role);
      return;
    }

    if (overId === `subs-drop-zone-${teamId}`) {
      moveToSubs(teamId, activeId);
      return;
    }

    if (activeId !== overId) {
      const draggedPlayer = players.find((p) => p.id === activeId);
      const targetPlayer = players.find((p) => p.id === overId);

      if (draggedPlayer && targetPlayer) {
        swapPlayerRoles(teamId, activeId, overId);
      }
    }
  };

  const handleAddTeam = () => {
    if (newTeamName.trim()) {
      const team = addTeam(newTeamName.trim());
      setNewTeamName('');
      setIsAddModalOpen(false);
      setExpandedTeamId(team.id);
    }
  };

  const handleImport = () => {
    setImportError('');
    const parsed = parseOpggMultiSearchUrl(importUrl);

    if (!parsed) {
      setImportError('Invalid OP.GG multi-search URL. Make sure it looks like: https://www.op.gg/multisearch/euw?summoners=...');
      return;
    }

    if (parsed.players.length === 0) {
      setImportError('No players found in URL');
      return;
    }

    const teamName = importTeamName.trim() || `Imported Team ${teams.length + 1}`;
    const team = importTeamFromOpgg(teamName, parsed.region, parsed.players);

    setImportUrl('');
    setImportTeamName('');
    setIsImportModalOpen(false);
    setExpandedTeamId(team.id);
  };

  const handleInlineImport = (teamId: string) => {
    const url = inlineImportUrl[teamId] || '';
    setInlineImportError((prev) => ({ ...prev, [teamId]: '' }));

    const parsed = parseOpggMultiSearchUrl(url);

    if (!parsed) {
      setInlineImportError((prev) => ({
        ...prev,
        [teamId]: 'Invalid OP.GG URL. Use format: https://www.op.gg/multisearch/euw?summoners=...',
      }));
      return;
    }

    if (parsed.players.length === 0) {
      setInlineImportError((prev) => ({ ...prev, [teamId]: 'No players found in URL' }));
      return;
    }

    importPlayersToTeam(teamId, parsed.region, parsed.players);
    setInlineImportUrl((prev) => ({ ...prev, [teamId]: '' }));
  };

  const handleDeleteTeam = (id: string) => {
    if (confirm('Are you sure you want to delete this team?')) {
      deleteTeam(id);
      if (expandedTeamId === id) {
        setExpandedTeamId(null);
      }
    }
  };

  const toggleExpanded = (id: string) => {
    setExpandedTeamId(expandedTeamId === id ? null : id);
  };

  const getMainRoster = (players: typeof teams[0]['players']) =>
    players.filter(p => !p.isSub);

  const getSubs = (players: typeof teams[0]['players']) =>
    players.filter(p => p.isSub);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Enemy Teams</h1>
          <p className="text-gray-400 mt-1">Scout and track your opponents</p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => setIsImportModalOpen(true)}>
            Import from OP.GG
          </Button>
          <Button onClick={() => setIsAddModalOpen(true)}>+ Add Team</Button>
        </div>
      </div>

      {teams.length === 0 ? (
        <Card className="text-center py-12">
          <div className="text-gray-500 mb-2">
            <svg className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <p className="text-gray-400 mb-6">No enemy teams added yet</p>
          <div className="flex gap-3 justify-center">
            <Button variant="secondary" onClick={() => setIsImportModalOpen(true)}>
              Import from OP.GG
            </Button>
            <Button onClick={() => setIsAddModalOpen(true)}>Add Manually</Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {teams.map((team) => {
            const mainRoster = getMainRoster(team.players);
            const subs = getSubs(team.players);
            const filledPlayers = team.players.filter((p) => p.summonerName).length;
            const isExpanded = expandedTeamId === team.id;

            return (
              <Card key={team.id} variant="bordered" padding="lg">
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => toggleExpanded(team.id)}
                >
                  <div>
                    <h2 className="text-xl font-semibold text-white">{team.name}</h2>
                    <p className="text-sm text-gray-400 mt-1">
                      {filledPlayers} players ({mainRoster.filter(p => p.summonerName).length} main{subs.length > 0 && `, ${subs.filter(p => p.summonerName).length} subs`})
                    </p>
                  </div>
                  <div className={`p-2 rounded-lg transition-all duration-200 ${isExpanded ? 'bg-lol-gold/20 text-lol-gold' : 'text-gray-500 hover:text-white'}`}>
                    <svg className={`w-5 h-5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-6 pt-6 border-t border-lol-border space-y-6">
                    <Input
                      label="Team Name"
                      value={team.name}
                      onChange={(e) => updateTeam(team.id, { name: e.target.value })}
                    />

                    <div>
                      <h3 className="text-sm font-medium text-gray-300 mb-3">Import Players from OP.GG</h3>
                      <div className="flex gap-2">
                        <Input
                          value={inlineImportUrl[team.id] || ''}
                          onChange={(e) => {
                            setInlineImportUrl((prev) => ({ ...prev, [team.id]: e.target.value }));
                            setInlineImportError((prev) => ({ ...prev, [team.id]: '' }));
                          }}
                          placeholder="Paste OP.GG multi-search URL..."
                          className="flex-1"
                        />
                        <Button
                          onClick={() => handleInlineImport(team.id)}
                          disabled={!inlineImportUrl[team.id]?.trim()}
                        >
                          Import
                        </Button>
                      </div>
                      {inlineImportError[team.id] && (
                        <p className="text-sm text-red-400 mt-2">{inlineImportError[team.id]}</p>
                      )}
                    </div>

                    <div>
                      <h3 className="text-sm font-medium text-gray-300 mb-3">OP.GG Links</h3>
                      <OpggLinks team={team} />
                    </div>

                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragStart={(e) => handleDragStart(e, team.id, team.players)}
                      onDragEnd={(e) => handleDragEnd(e, team.id, team.players)}
                    >
                      {/* Main Roster */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-medium text-gray-300">Main Roster</h3>
                          <p className="text-xs text-gray-500">Drag players to swap roles</p>
                        </div>
                        <SortableContext
                          items={mainRoster.map((p) => p.id)}
                          strategy={horizontalListSortingStrategy}
                        >
                          <div className="flex gap-3 p-2 rounded-xl bg-lol-dark/50">
                            {ROLES.map((role) => {
                              const player = mainRoster.find((p) => p.role === role.value);
                              return (
                                <RoleSlot
                                  key={role.value}
                                  role={role.value as Role}
                                  player={player}
                                  onPlayerChange={(playerId, updates) =>
                                    updatePlayer(team.id, playerId, updates)
                                  }
                                />
                              );
                            })}
                          </div>
                        </SortableContext>
                      </div>

                      {/* Subs Section */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-medium text-gray-300">Substitutes</h3>
                          <Button variant="ghost" size="sm" onClick={() => addSub(team.id)}>
                            + Add Sub
                          </Button>
                        </div>
                        <SortableContext items={subs.map((p) => p.id)}>
                          <SubsDropZone teamId={team.id}>
                            {subs.length === 0 ? (
                              <p className="text-sm text-gray-500 p-4 w-full text-center">
                                No subs - drag a player here or click Add Sub
                              </p>
                            ) : (
                              subs.map((sub) => (
                                <SubSlot
                                  key={sub.id}
                                  player={sub}
                                  onPlayerChange={(playerId, updates) =>
                                    updatePlayer(team.id, playerId, updates)
                                  }
                                  onRemove={() => removeSub(team.id, sub.id)}
                                />
                              ))
                            )}
                          </SubsDropZone>
                        </SortableContext>
                      </div>

                      {/* Drag Overlay */}
                      <DragOverlay>
                        {activePlayer && activeDragTeamId === team.id ? (
                          <div className="bg-lol-card border border-lol-gold rounded-xl px-4 py-3 shadow-xl shadow-lol-gold/20">
                            <div className="font-semibold text-lol-gold text-sm">
                              {ROLES.find((r) => r.value === activePlayer.role)?.label}
                            </div>
                            <div className="text-white font-medium mt-1">{activePlayer.summonerName || 'Empty'}</div>
                            <div className="text-gray-400 text-xs mt-0.5">#{activePlayer.tagLine}</div>
                          </div>
                        ) : null}
                      </DragOverlay>
                    </DndContext>

                    <div>
                      <label className="text-sm font-medium text-gray-300 block mb-2">Team Notes</label>
                      <textarea
                        value={team.notes}
                        onChange={(e) => updateTeam(team.id, { notes: e.target.value })}
                        placeholder="Notes about this team..."
                        className="w-full px-4 py-3 bg-lol-dark border border-lol-border rounded-xl text-white placeholder-gray-500 resize-none focus:outline-none focus:border-lol-gold/50 focus:ring-2 focus:ring-lol-gold/20 transition-all duration-200 min-h-[100px]"
                        rows={3}
                      />
                    </div>

                    {/* Player Champion Pools */}
                    <div>
                      <h3 className="text-sm font-medium text-gray-300 mb-4">Player Champion Pools</h3>

                      {/* Player Tabs - Main Roster */}
                      <div className="flex flex-wrap gap-2 mb-4">
                        <div className="flex gap-2 bg-lol-dark p-1.5 rounded-xl border border-lol-border">
                          {mainRoster.map((player) => {
                            const roleLabel = ROLES.find((r) => r.value === player.role)?.label || player.role;
                            const selectedId = selectedPlayerIds[team.id] || mainRoster[0]?.id;
                            const isSelected = player.id === selectedId;
                            const champCount = (player.championGroups || []).reduce((acc, g) => acc + g.championIds.length, 0);
                            return (
                              <button
                                key={player.id}
                                onClick={() => setSelectedPlayerIds((prev) => ({ ...prev, [team.id]: player.id }))}
                                className={`px-4 py-2.5 rounded-lg font-medium transition-all duration-200 ${
                                  isSelected
                                    ? 'bg-gradient-to-b from-lol-gold-light to-lol-gold text-lol-dark shadow-md'
                                    : 'text-gray-400 hover:text-white hover:bg-lol-surface'
                                }`}
                              >
                                <div className="text-sm">{roleLabel}</div>
                                <div className={`text-xs mt-0.5 ${isSelected ? 'text-lol-dark/70' : 'text-gray-500'}`}>
                                  {player.summonerName || 'Empty'} {champCount > 0 && `(${champCount})`}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                        {/* Subs Tabs */}
                        {subs.length > 0 && (
                          <div className="flex gap-2 bg-lol-dark p-1.5 rounded-xl border border-lol-border/50">
                            {subs.map((player) => {
                              const selectedId = selectedPlayerIds[team.id] || mainRoster[0]?.id;
                              const isSelected = player.id === selectedId;
                              const champCount = (player.championGroups || []).reduce((acc, g) => acc + g.championIds.length, 0);
                              return (
                                <button
                                  key={player.id}
                                  onClick={() => setSelectedPlayerIds((prev) => ({ ...prev, [team.id]: player.id }))}
                                  className={`px-4 py-2.5 rounded-lg font-medium transition-all duration-200 ${
                                    isSelected
                                      ? 'bg-gradient-to-b from-lol-gold-light to-lol-gold text-lol-dark shadow-md'
                                      : 'text-gray-400 hover:text-white hover:bg-lol-surface'
                                  }`}
                                >
                                  <div className="text-sm text-orange-400">Sub</div>
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
                      {(() => {
                        const selectedId = selectedPlayerIds[team.id] || mainRoster[0]?.id;
                        const selectedPlayer = team.players.find((p) => p.id === selectedId);
                        if (!selectedPlayer) return null;
                        return (
                          <PlayerTierList
                            player={selectedPlayer}
                            onAddChampion={(groupId, championId) => addChampionToGroup(team.id, selectedPlayer.id, groupId, championId)}
                            onRemoveChampion={(groupId, championId) => removeChampionFromGroup(team.id, selectedPlayer.id, groupId, championId)}
                            onMoveChampion={(fromGroupId, toGroupId, championId, newIndex) => moveChampion(team.id, selectedPlayer.id, fromGroupId, toGroupId, championId, newIndex)}
                            onReorderChampion={(groupId, championId, newIndex) => reorderChampionInGroup(team.id, selectedPlayer.id, groupId, championId, newIndex)}
                            onAddGroup={(groupName) => addGroup(team.id, selectedPlayer.id, groupName)}
                            onRemoveGroup={(groupId) => removeGroup(team.id, selectedPlayer.id, groupId)}
                            onRenameGroup={(groupId, newName) => renameGroup(team.id, selectedPlayer.id, groupId, newName)}
                            onReorderGroups={(groupIds) => reorderGroups(team.id, selectedPlayer.id, groupIds)}
                          />
                        );
                      })()}
                    </div>

                    <div className="flex justify-end pt-2">
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleDeleteTeam(team.id)}
                      >
                        Delete Team
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Team Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Enemy Team"
      >
        <div className="space-y-6">
          <Input
            label="Team Name"
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            placeholder="e.g., Team Liquid"
            autoFocus
            size="lg"
          />
          <div className="flex gap-3 justify-end">
            <Button variant="ghost" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddTeam} disabled={!newTeamName.trim()}>
              Add Team
            </Button>
          </div>
        </div>
      </Modal>

      {/* Import Modal */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => {
          setIsImportModalOpen(false);
          setImportError('');
          setImportUrl('');
          setImportTeamName('');
        }}
        title="Import from OP.GG"
      >
        <div className="space-y-5">
          <p className="text-sm text-gray-400 bg-lol-dark rounded-lg p-4 border border-lol-border">
            Paste an OP.GG multi-search URL to automatically import player names.
          </p>
          <Input
            label="OP.GG Multi-Search URL"
            value={importUrl}
            onChange={(e) => {
              setImportUrl(e.target.value);
              setImportError('');
            }}
            placeholder="https://www.op.gg/multisearch/euw?summoners=..."
            autoFocus
          />
          <Input
            label="Team Name (optional)"
            value={importTeamName}
            onChange={(e) => setImportTeamName(e.target.value)}
            placeholder="e.g., Week 3 Opponent"
          />
          {importError && (
            <p className="text-sm text-red-400 bg-red-500/10 rounded-lg p-3 border border-red-500/20">{importError}</p>
          )}
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="ghost" onClick={() => {
              setIsImportModalOpen(false);
              setImportError('');
            }}>
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={!importUrl.trim()}>
              Import
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
