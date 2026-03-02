import { useState, useEffect, useCallback } from 'react';
import { ChampionPatchChange, SpellChange } from '../../types';
import { getPatchVersions, comparePatch, CompareProgress, PatchVersion } from '../../lib/patchService';
import { getChampionIconUrlSync } from '../../lib/datadragon';

export default function PatchTracker() {
  const [patches, setPatches] = useState<PatchVersion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [changes, setChanges] = useState<ChampionPatchChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<CompareProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const onProgress = useCallback((p: CompareProgress) => {
    setProgress(p);
  }, []);

  useEffect(() => {
    let mounted = true;
    getPatchVersions()
      .then((p) => {
        if (mounted) setPatches(p);
      })
      .catch((err) => {
        if (mounted) setError('Failed to load patch versions');
        console.error(err);
      });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (patches.length < 2) return;

    const current = patches[selectedIndex];
    const previous = patches[selectedIndex + 1];
    if (!current || !previous) {
      setChanges([]);
      setLoading(false);
      return;
    }

    let mounted = true;
    setLoading(true);
    setError(null);
    setProgress(null);

    comparePatch(current.version, previous.version, onProgress)
      .then((result) => {
        if (mounted) {
          setChanges(result);
          setLoading(false);
          setProgress(null);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError('Failed to compare patches');
          setLoading(false);
          setProgress(null);
        }
        console.error(err);
      });

    return () => { mounted = false; };
  }, [patches, selectedIndex, onProgress]);

  const normalize = (s: string) => s.toLowerCase().replace(/['\s-]/g, '');
  const filtered = search
    ? changes.filter((c) => normalize(c.championName).includes(normalize(search)))
    : changes;

  const selectablePatches = patches.slice(0, -1);

  const loadingMessage = (() => {
    if (!progress) return 'Loading patch data…';
    if (progress.phase === 'ddragon') return 'Comparing DDragon data…';
    const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
    return `Scanning game data… ${pct}%`;
  })();

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={selectedIndex}
          onChange={(e) => setSelectedIndex(Number(e.target.value))}
          className="bg-lol-surface border border-lol-border text-white rounded px-3 py-1.5 text-sm focus:outline-none focus:border-lol-gold"
        >
          {selectablePatches.map((p, i) => (
            <option key={p.version} value={i}>
              Patch {p.patch}
            </option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Search champions…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-lol-surface border border-lol-border text-white rounded px-3 py-1.5 text-sm placeholder-gray-500 focus:outline-none focus:border-lol-gold w-52"
        />

        {!loading && (
          <span className="text-gray-500 text-xs ml-auto">
            {filtered.length} champion{filtered.length !== 1 ? 's' : ''} changed
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1">
        {loading && (
          <div className="flex flex-col items-center justify-center h-40 gap-2">
            <p className="text-gray-400 animate-pulse">{loadingMessage}</p>
            {progress?.phase === 'cdragon' && progress.total > 0 && (
              <div className="w-48 h-1 bg-lol-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-lol-gold/60 rounded-full transition-all duration-300"
                  style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
                />
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center h-40 gap-3">
            <p className="text-red-400">{error}</p>
            <button
              onClick={() => setSelectedIndex((i) => i)}
              className="text-sm text-lol-gold hover:underline"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="flex items-center justify-center h-40">
            <p className="text-gray-500">
              {search
                ? 'No matching champions found'
                : 'No changes detected for this patch'}
            </p>
          </div>
        )}

        {!loading &&
          !error &&
          filtered.map((champ) => (
            <ChampionChangeCard
              key={champ.championId}
              change={champ}
              currentVersion={patches[selectedIndex]?.version ?? ''}
            />
          ))}
      </div>
    </div>
  );
}

function ChampionChangeCard({
  change,
  currentVersion,
}: {
  change: ChampionPatchChange;
  currentVersion: string;
}) {
  const iconUrl = getChampionIconUrlSync(currentVersion, change.championId);

  return (
    <div className="bg-lol-card border border-lol-border rounded-lg p-3">
      <div className="flex gap-3">
        <img
          src={iconUrl}
          alt={change.championName}
          className="w-10 h-10 rounded shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-white font-medium text-sm">
              {change.championName}
            </span>
            {change.isNew && (
              <span className="text-xs bg-lol-gold/20 text-lol-gold px-1.5 py-0.5 rounded">
                New Champion
              </span>
            )}
          </div>

          {/* Base stat changes */}
          {change.changes.length > 0 && (
            <div className="mt-1.5 space-y-0.5">
              {change.changes.map((sc) => {
                const diff = sc.newValue - sc.oldValue;
                const sign = diff > 0 ? '+' : '';
                const color =
                  sc.direction === 'buff' ? 'text-green-400' : 'text-red-400';

                return (
                  <div
                    key={sc.stat}
                    className="flex items-center gap-2 text-xs"
                  >
                    <span className="text-gray-400 w-36 shrink-0">
                      {sc.label}
                    </span>
                    <span className="text-gray-500">
                      {formatValue(sc.oldValue)}
                    </span>
                    <span className="text-gray-600">→</span>
                    <span className="text-white">
                      {formatValue(sc.newValue)}
                    </span>
                    <span className={`${color} ml-auto font-medium`}>
                      {sign}
                      {formatValue(diff)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Ability changes */}
          {change.spellChanges.length > 0 && (
            <div className={`space-y-1.5 ${change.changes.length > 0 ? 'mt-2 pt-2 border-t border-lol-border' : 'mt-1.5'}`}>
              {change.spellChanges.map((spell) => (
                <SpellChangeRow key={spell.spellKey} spell={spell} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SpellChangeRow({ spell }: { spell: SpellChange }) {
  return (
    <div className="text-xs">
      {/* Header: only show spell key and name if spellName is present */}
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className="text-lol-gold font-medium">{spell.spellKey}</span>
        {spell.spellName && (
          <>
            <span className="text-gray-400">—</span>
            <span className="text-gray-300">{spell.spellName}</span>
          </>
        )}
      </div>
      <div className="pl-5 space-y-0.5">
        {spell.changes.map((vc) => {
          const color =
            vc.direction === 'buff'
              ? 'text-green-400'
              : vc.direction === 'nerf'
                ? 'text-red-400'
                : 'text-yellow-400';

          // Fallback "Modified" entries (tooltip-only or hash-only detection)
          if (vc.oldValue === 'Modified' && vc.newValue === 'Modified') {
            return (
              <div key={vc.field} className="flex items-center gap-2">
                <span className="text-yellow-400/70 italic">Values modified</span>
              </div>
            );
          }

          return (
            <div key={vc.field} className="flex items-center gap-2">
              <span className="text-gray-400 shrink-0">{vc.field}</span>
              <span className="text-gray-500">{vc.oldValue}</span>
              <span className="text-gray-600">→</span>
              <span className={color}>{vc.newValue}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatValue(val: number): string {
  return parseFloat(val.toFixed(3)).toString();
}
