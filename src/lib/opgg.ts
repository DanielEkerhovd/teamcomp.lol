import { Player, Region } from '../types';

const OPGG_BASE = 'https://www.op.gg';

/**
 * Generate OP.GG profile URL for a single player
 */
export function getPlayerOpggUrl(player: Player): string {
  if (!player.summonerName) return '';

  const name = encodeURIComponent(player.summonerName);
  const tag = player.tagLine ? encodeURIComponent(player.tagLine) : '';

  if (tag) {
    return `${OPGG_BASE}/summoners/${player.region}/${name}-${tag}`;
  }
  return `${OPGG_BASE}/summoners/${player.region}/${name}`;
}

/**
 * Generate OP.GG multi-search URL for a team
 */
export function getMultiSearchUrl(players: Player[], region: Region): string {
  const validPlayers = players.filter((p) => p.summonerName);
  if (validPlayers.length === 0) return '';

  const names = validPlayers
    .map((p) => {
      if (p.tagLine) {
        return `${p.summonerName}#${p.tagLine}`;
      }
      return p.summonerName;
    })
    .join(',');

  return `${OPGG_BASE}/multisearch/${region}?summoners=${encodeURIComponent(names)}`;
}

/**
 * Get the region display name for a given region code
 */
export function getRegionDisplayName(region: Region): string {
  const regionNames: Record<Region, string> = {
    euw: 'EU West',
    eune: 'EU Nordic & East',
    na: 'North America',
    kr: 'Korea',
    br: 'Brazil',
    lan: 'Latin America North',
    las: 'Latin America South',
    oce: 'Oceania',
    tr: 'Turkey',
    ru: 'Russia',
    jp: 'Japan',
    ph: 'Philippines',
    sg: 'Singapore',
    th: 'Thailand',
    tw: 'Taiwan',
    vn: 'Vietnam',
  };
  return regionNames[region] || region.toUpperCase();
}
