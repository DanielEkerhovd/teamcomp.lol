import { Team, Region, DEFAULT_REGION } from '../../types';
import { useOpgg } from '../../hooks/useOpgg';
import { Button } from '../ui';

interface OpggLinksProps {
  team: Team;
  region?: Region;
}

export default function OpggLinks({ team, region }: OpggLinksProps) {
  const { openPlayerProfile, openMultiSearch, getPlayerUrl, getTeamMultiSearchUrl } = useOpgg();

  // Use the first player's region or default
  const teamRegion = region || team.players[0]?.region || DEFAULT_REGION;
  const validPlayers = team.players.filter((p) => p.summonerName);
  const multiSearchUrl = getTeamMultiSearchUrl(team.players, teamRegion);

  if (validPlayers.length === 0) {
    return (
      <div className="text-gray-500 text-sm">
        Add player names to generate OP.GG links
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {validPlayers.map((player) => {
          const url = getPlayerUrl(player);
          return (
            <a
              key={player.id}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1 bg-lol-dark border border-gray-600 rounded-lg text-sm text-gray-300 hover:text-lol-gold hover:border-lol-gold transition-colors"
            >
              {player.summonerName}
              {player.tagLine && <span className="text-gray-500">#{player.tagLine}</span>}
            </a>
          );
        })}
      </div>

      {validPlayers.length > 1 && multiSearchUrl && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => openMultiSearch(team.players, teamRegion)}
        >
          Multi-Search All ({validPlayers.length}) →
        </Button>
      )}
    </div>
  );
}
