import { supabase } from './supabase';

export interface ContentItem {
  id: string;
  name: string;
  updatedAt: string;
  playerCount?: number;
  playerNames?: string[];
}

export interface DowngradeContentData {
  myTeams: ContentItem[];
  enemyTeams: ContentItem[];
  drafts: ContentItem[];
}

/**
 * Fetch all non-archived content for the user (for the downgrade selection modal).
 */
export async function getContentForSelection(userId: string): Promise<DowngradeContentData> {
  if (!supabase) return { myTeams: [], enemyTeams: [], drafts: [] };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const [myTeamsRes, enemyTeamsRes, draftsRes] = await Promise.all([
    sb.from('my_teams')
      .select('id, name, updated_at')
      .eq('user_id', userId)
      .is('archived_at', null)
      .order('updated_at', { ascending: false }),
    sb.from('enemy_teams')
      .select('id, name, updated_at')
      .eq('user_id', userId)
      .is('archived_at', null)
      .is('team_id', null) // Only personal enemy teams (not team-plan ones)
      .order('updated_at', { ascending: false }),
    sb.from('draft_sessions')
      .select('id, name, updated_at')
      .eq('user_id', userId)
      .is('archived_at', null)
      .order('updated_at', { ascending: false }),
  ]);

  // Fetch player names for my_teams
  const myTeams: ContentItem[] = [];
  if (myTeamsRes.data) {
    for (const team of myTeamsRes.data) {
      const { data: players } = await sb
        .from('players')
        .select('summoner_name')
        .eq('team_id', team.id);
      const playerNames = (players || [])
        .map((p: { summoner_name: string }) => p.summoner_name?.trim())
        .filter(Boolean);
      myTeams.push({
        id: team.id,
        name: team.name || 'Unnamed Team',
        updatedAt: team.updated_at,
        playerCount: playerNames.length,
        playerNames,
      });
    }
  }

  // Fetch player names for enemy_teams
  const enemyTeams: ContentItem[] = [];
  if (enemyTeamsRes.data) {
    for (const team of enemyTeamsRes.data) {
      const { data: players } = await sb
        .from('enemy_players')
        .select('summoner_name')
        .eq('team_id', team.id);
      const playerNames = (players || [])
        .map((p: { summoner_name: string }) => p.summoner_name?.trim())
        .filter(Boolean);
      enemyTeams.push({
        id: team.id,
        name: team.name || 'Unnamed Team',
        updatedAt: team.updated_at,
        playerCount: playerNames.length,
        playerNames,
      });
    }
  }

  const drafts: ContentItem[] = (draftsRes.data || []).map(
    (d: { id: string; name: string; updated_at: string }) => ({
      id: d.id,
      name: d.name || 'Unnamed Draft',
      updatedAt: d.updated_at,
    })
  );

  return { myTeams, enemyTeams, drafts };
}

/**
 * Archive content that the user chose NOT to keep.
 * Sets archived_at = NOW() on the specified IDs.
 */
export async function archiveContent(
  userId: string,
  toArchive: { teamIds: string[]; enemyTeamIds: string[]; draftIds: string[] }
): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Not configured' };

  const now = new Date().toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const promises: Promise<unknown>[] = [];

  if (toArchive.teamIds.length > 0) {
    promises.push(
      sb.from('my_teams')
        .update({ archived_at: now })
        .eq('user_id', userId)
        .in('id', toArchive.teamIds)
    );
  }

  if (toArchive.enemyTeamIds.length > 0) {
    promises.push(
      sb.from('enemy_teams')
        .update({ archived_at: now })
        .eq('user_id', userId)
        .in('id', toArchive.enemyTeamIds)
    );
  }

  if (toArchive.draftIds.length > 0) {
    promises.push(
      sb.from('draft_sessions')
        .update({ archived_at: now })
        .eq('user_id', userId)
        .in('id', toArchive.draftIds)
    );
  }

  try {
    await Promise.all(promises);
    return { error: null };
  } catch (err) {
    console.error('Failed to archive content:', err);
    return { error: 'Failed to archive content' };
  }
}

/**
 * Clear the downgraded_at flag on the user's profile.
 */
export async function clearDowngradeFlag(userId: string): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Not configured' };

  const { error } = await supabase
    .from('profiles')
    .update({ downgraded_at: null } as never)
    .eq('id', userId);

  if (error) {
    console.error('Failed to clear downgrade flag:', error);
    return { error: error.message };
  }
  return { error: null };
}
