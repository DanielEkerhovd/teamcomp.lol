import { useState, useEffect, useMemo, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { useChampionData } from '../hooks/useChampionData';
import { getCenteredSplashUrl, loadSplashMap } from '../lib/datadragon';
import { useChampionFacingStore, type Facing } from '../data/championFacing';
import { useAuthStore } from '../stores/useAuthStore';

type FilterMode = 'all' | 'left' | 'right' | 'missing';

export default function SplashArtsPage() {
  const { profile } = useAuthStore();
  const { champions, loading } = useChampionData();
  const [filter, setFilter] = useState<FilterMode>('all');
  const [search, setSearch] = useState('');
  const [splashMapReady, setSplashMapReady] = useState(false);

  // Load CDragon skins.json so getCenteredSplashUrl returns correct URLs
  useEffect(() => {
    loadSplashMap().then(() => setSplashMapReady(true));
  }, []);

  const facingMap = useChampionFacingStore((s) => s.facingMap);
  const setChampionFacing = useChampionFacingStore((s) => s.setChampionFacing);

  // Developer-only guard
  if (profile?.tier !== 'developer') {
    return <Navigate to="/" replace />;
  }

  const filtered = useMemo(() => {
    let list = champions;

    if (search) {
      const q = search.toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q));
    }

    if (filter === 'left') {
      list = list.filter((c) => facingMap[c.id] === 'left');
    } else if (filter === 'right') {
      list = list.filter((c) => facingMap[c.id] === 'right');
    } else if (filter === 'missing') {
      list = list.filter((c) => !(c.id in facingMap));
    }

    return list;
  }, [champions, filter, search, facingMap]);

  const stats = useMemo(() => {
    const total = champions.length;
    const left = champions.filter((c) => facingMap[c.id] === 'left').length;
    const right = champions.filter((c) => facingMap[c.id] === 'right').length;
    const missing = champions.filter((c) => !(c.id in facingMap)).length;
    return { total, left, right, missing };
  }, [champions, facingMap]);

  const handleToggleFacing = useCallback(async (championId: string) => {
    const current = facingMap[championId] || 'right';
    const newFacing: Facing = current === 'right' ? 'left' : 'right';
    const result = await setChampionFacing(championId, newFacing);
    if (!result.success) {
      console.error('Failed to update facing:', result.message);
    }
  }, [facingMap, setChampionFacing]);

  if (loading || !splashMapReady) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading champions...</div>
      </div>
    );
  }

  return (
    <div className="max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Splash Art Facing</h1>
        <p className="text-gray-400 text-sm mt-1">
          Click a champion card to toggle its facing direction. Changes save automatically to the database.
        </p>
      </div>

      {/* Stats & Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <FilterButton
          active={filter === 'all'}
          onClick={() => setFilter('all')}
          label={`All (${stats.total})`}
        />
        <FilterButton
          active={filter === 'right'}
          onClick={() => setFilter('right')}
          label={`Facing Right (${stats.right})`}
          color="blue"
        />
        <FilterButton
          active={filter === 'left'}
          onClick={() => setFilter('left')}
          label={`Facing Left (${stats.left})`}
          color="red"
        />
        {stats.missing > 0 && (
          <FilterButton
            active={filter === 'missing'}
            onClick={() => setFilter('missing')}
            label={`Missing (${stats.missing})`}
            color="yellow"
          />
        )}

        <div className="ml-auto">
          <input
            type="text"
            placeholder="Search champion..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-lol-dark/60 border border-lol-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-lol-gold/50 w-56"
          />
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 mb-4 text-xs text-gray-500">
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded bg-blue-500/30 border border-blue-500/50" />
          Blue side preview (should face right →)
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded bg-red-500/30 border border-red-500/50" />
          Red side preview (should face ← left)
        </div>
        <div className="text-gray-600">Click any card to toggle</div>
      </div>

      {/* Champion Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4">
        {filtered.map((champ) => (
          <ChampionCard
            key={champ.id}
            championId={champ.id}
            name={champ.name}
            facing={facingMap[champ.id] ?? null}
            onToggle={() => handleToggleFacing(champ.id)}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center text-gray-500 py-16">No champions match your filter.</div>
      )}
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  label,
  color,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  color?: 'blue' | 'red' | 'yellow';
}) {
  const colorClasses = active
    ? 'bg-lol-gold/20 text-lol-gold border-lol-gold/50'
    : color === 'blue'
      ? 'text-blue-400 border-lol-border hover:border-blue-500/50'
      : color === 'red'
        ? 'text-red-400 border-lol-border hover:border-red-500/50'
        : color === 'yellow'
          ? 'text-yellow-400 border-lol-border hover:border-yellow-500/50'
          : 'text-gray-400 border-lol-border hover:border-gray-500';

  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${colorClasses}`}
    >
      {label}
    </button>
  );
}

function ChampionCard({
  championId,
  name,
  facing,
  onToggle,
}: {
  championId: string;
  name: string;
  facing: Facing | null;
  onToggle: () => void;
}) {
  const splashUrl = getCenteredSplashUrl(championId);
  const isMissing = facing === null;
  const facingLabel = isMissing ? '?' : facing === 'left' ? '← Left' : 'Right →';

  // For blue side: flip if facing left. For red side: flip if facing right.
  const flipForBlue = facing === 'left';
  const flipForRed = facing === 'right';

  return (
    <div
      onClick={onToggle}
      className={`rounded-xl border overflow-hidden bg-lol-dark/40 cursor-pointer transition-colors hover:border-lol-gold/50 ${isMissing ? 'border-yellow-500/50' : 'border-lol-border/50'}`}
    >
      {/* Champion name + facing badge */}
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-sm font-semibold text-white truncate">{name}</span>
        <span
          className={`text-[10px] font-bold px-1.5 py-0.5 rounded transition-colors ${
            isMissing
              ? 'bg-yellow-500/20 text-yellow-400'
              : facing === 'left'
                ? 'bg-red-500/20 text-red-400'
                : 'bg-blue-500/20 text-blue-400'
          }`}
        >
          {facingLabel}
        </span>
      </div>

      {/* Original splash (no flip) */}
      <div className="relative w-full aspect-[3/4] overflow-hidden">
        <img
          src={splashUrl}
          alt={name}
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover object-[center_15%]"
        />
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1">
          <span className="text-[10px] text-gray-300">Original</span>
        </div>
      </div>

      {/* Blue / Red side previews */}
      <div className="grid grid-cols-2 gap-px bg-lol-border/30">
        {/* Blue side */}
        <div className="relative aspect-[3/4] overflow-hidden bg-blue-950/20">
          <img
            src={splashUrl}
            alt={`${name} blue side`}
            loading="lazy"
            className={`absolute inset-0 w-full h-full object-cover object-[center_15%] ${flipForBlue ? '-scale-x-100' : ''}`}
          />
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-blue-950/90 to-transparent px-1.5 py-0.5">
            <span className="text-[9px] font-medium text-blue-300">Blue</span>
          </div>
        </div>

        {/* Red side */}
        <div className="relative aspect-[3/4] overflow-hidden bg-red-950/20">
          <img
            src={splashUrl}
            alt={`${name} red side`}
            loading="lazy"
            className={`absolute inset-0 w-full h-full object-cover object-[center_15%] ${flipForRed ? '-scale-x-100' : ''}`}
          />
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-red-950/90 to-transparent px-1.5 py-0.5">
            <span className="text-[9px] font-medium text-red-300">Red</span>
          </div>
        </div>
      </div>
    </div>
  );
}
