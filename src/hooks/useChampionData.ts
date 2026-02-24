import { useState, useEffect } from 'react';
import { Champion } from '../types';
import { getChampions, getLatestVersion, getChampionIconUrlSync } from '../lib/datadragon';

interface UseChampionDataReturn {
  champions: Champion[];
  version: string;
  loading: boolean;
  error: Error | null;
  getChampionById: (id: string) => Champion | undefined;
  getIconUrl: (championId: string) => string;
  searchChampions: (query: string) => Champion[];
}

export function useChampionData(): UseChampionDataReturn {
  const [champions, setChampions] = useState<Champion[]>([]);
  const [version, setVersion] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchData() {
      try {
        const [champData, ver] = await Promise.all([
          getChampions(),
          getLatestVersion(),
        ]);
        if (mounted) {
          setChampions(champData);
          setVersion(ver);
          setLoading(false);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error('Failed to fetch champion data'));
          setLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      mounted = false;
    };
  }, []);

  const getChampionById = (id: string): Champion | undefined => {
    return champions.find((c) => c.id === id);
  };

  const getIconUrl = (championId: string): string => {
    if (!version) return '';
    return getChampionIconUrlSync(version, championId);
  };

  const searchChampions = (query: string): Champion[] => {
    if (!query.trim()) return champions;

    // Normalize: lowercase and remove apostrophes/special characters
    const normalize = (str: string) => str.toLowerCase().replace(/['\s-]/g, '');
    const normalizedQuery = normalize(query);

    // Filter champions that match
    const matches = champions.filter((c) => {
      const normalizedName = normalize(c.name);
      return normalizedName.includes(normalizedQuery);
    });

    // Sort: exact matches first, then prefix matches, then contains matches
    return matches.sort((a, b) => {
      const aNorm = normalize(a.name);
      const bNorm = normalize(b.name);

      // Exact match gets highest priority
      const aExact = aNorm === normalizedQuery;
      const bExact = bNorm === normalizedQuery;
      if (aExact && !bExact) return -1;
      if (bExact && !aExact) return 1;

      // Prefix match gets second priority
      const aPrefix = aNorm.startsWith(normalizedQuery);
      const bPrefix = bNorm.startsWith(normalizedQuery);
      if (aPrefix && !bPrefix) return -1;
      if (bPrefix && !aPrefix) return 1;

      // Otherwise alphabetical
      return a.name.localeCompare(b.name);
    });
  };

  return {
    champions,
    version,
    loading,
    error,
    getChampionById,
    getIconUrl,
    searchChampions,
  };
}
