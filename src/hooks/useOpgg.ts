import { useMemo } from 'react';
import { Player, Region } from '../types';
import { getPlayerOpggUrl, getMultiSearchUrl } from '../lib/opgg';

interface UseOpggReturn {
  getPlayerUrl: (player: Player) => string;
  getTeamMultiSearchUrl: (players: Player[], region: Region) => string;
  openPlayerProfile: (player: Player) => void;
  openMultiSearch: (players: Player[], region: Region) => void;
}

export function useOpgg(): UseOpggReturn {
  return useMemo(
    () => ({
      getPlayerUrl: getPlayerOpggUrl,
      getTeamMultiSearchUrl: getMultiSearchUrl,
      openPlayerProfile: (player: Player) => {
        const url = getPlayerOpggUrl(player);
        if (url) window.open(url, '_blank');
      },
      openMultiSearch: (players: Player[], region: Region) => {
        const url = getMultiSearchUrl(players, region);
        if (url) window.open(url, '_blank');
      },
    }),
    []
  );
}
