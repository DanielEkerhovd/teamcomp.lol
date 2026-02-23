import { useState, useRef, useEffect } from 'react';
import { useChampionData } from '../../hooks/useChampionData';
import { Champion } from '../../types';
import { Input } from '../ui';

interface ChampionSearchProps {
  onSelect: (champion: Champion) => void;
  placeholder?: string;
  excludeIds?: string[];
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'minimal';
  compact?: boolean;
}

export default function ChampionSearch({
  onSelect,
  placeholder = 'Search champions...',
  excludeIds = [],
  size = 'sm',
  variant = 'default',
  compact = false,
}: ChampionSearchProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const { searchChampions, getIconUrl, loading } = useChampionData();
  const wrapperRef = useRef<HTMLDivElement>(null);

  const results = searchChampions(query).filter(
    (c) => !excludeIds.includes(c.id)
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (champion: Champion) => {
    onSelect(champion);
    setQuery('');
    setIsOpen(false);
  };

  if (loading) {
    if (compact) {
      return <span className="text-gray-500 text-xs">...</span>;
    }
    return <Input placeholder="Loading champions..." disabled size={size} variant={variant} />;
  }

  if (compact) {
    return (
      <div ref={wrapperRef} className="relative">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && results.length > 0) {
              e.preventDefault();
              handleSelect(results[0]);
            }
          }}
          placeholder={placeholder}
          className="w-20 px-2 py-1 text-xs bg-lol-dark border border-lol-border rounded text-white placeholder-gray-500 focus:outline-none focus:border-lol-border-light"
        />
        {isOpen && query && results.length > 0 && (
          <div className="absolute z-50 w-48 right-0 mt-1 bg-lol-gray border border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {results.slice(0, 8).map((champion) => (
              <button
                key={champion.id}
                type="button"
                onClick={() => handleSelect(champion)}
                className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-gray-700 text-left"
              >
                <img
                  src={getIconUrl(champion.id)}
                  alt={champion.name}
                  className="w-6 h-6 rounded"
                  loading="lazy"
                />
                <span className="text-white text-sm">{champion.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && results.length > 0) {
            e.preventDefault();
            handleSelect(results[0]);
          }
        }}
        placeholder={placeholder}
        size={size}
        variant={variant}
      />
      {isOpen && query && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-lol-gray border border-gray-600 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {results.slice(0, 10).map((champion) => (
            <button
              key={champion.id}
              type="button"
              onClick={() => handleSelect(champion)}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-700 text-left"
            >
              <img
                src={getIconUrl(champion.id)}
                alt={champion.name}
                className="w-8 h-8 rounded"
                loading="lazy"
              />
              <span className="text-white">{champion.name}</span>
            </button>
          ))}
        </div>
      )}
      {isOpen && query && results.length === 0 && (
        <div className="absolute z-50 w-full mt-1 bg-lol-gray border border-gray-600 rounded-lg shadow-lg p-3 text-gray-400">
          No champions found
        </div>
      )}
    </div>
  );
}
