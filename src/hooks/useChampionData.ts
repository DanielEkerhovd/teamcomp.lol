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
    const lowerQuery = query.toLowerCase();
    return champions.filter((c) =>
      c.name.toLowerCase().includes(lowerQuery)
    );
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
