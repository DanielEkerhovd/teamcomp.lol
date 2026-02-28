import { useMemo } from 'react';
import { useChampionData } from '../../hooks/useChampionData';
import type { DbLiveDraftUnavailableChampion, DraftMode } from '../../types/liveDraft';

interface FearlessBarProps {
  draftMode: DraftMode;
  fearlessChampions: DbLiveDraftUnavailableChampion[];
  currentGameNumber: number;
}

const iconStyle = { filter: 'grayscale(100%) brightness(0.75)' };

export default function FearlessBar({
  draftMode,
  fearlessChampions,
  currentGameNumber,
}: FearlessBarProps) {
  const { getIconUrl, getChampionById } = useChampionData();

  const byGame = useMemo(() => {
    const map = new Map<number, DbLiveDraftUnavailableChampion[]>();
    for (const uc of fearlessChampions) {
      if (uc.from_game >= currentGameNumber) continue;
      if (draftMode === 'fearless' && uc.reason === 'banned') continue;
      const list = map.get(uc.from_game);
      if (list) {
        list.push(uc);
      } else {
        map.set(uc.from_game, [uc]);
      }
    }
    return map;
  }, [fearlessChampions, currentGameNumber, draftMode]);

  if (draftMode === 'normal' || byGame.size === 0) return null;

  const sortedGames = [...byGame.entries()].sort(([a], [b]) => a - b);

  /* Split into rows of 2 games so it wraps when there are 3+ games (game 4+) */
  const rows: typeof sortedGames[] = [];
  for (let i = 0; i < sortedGames.length; i += 2) {
    rows.push(sortedGames.slice(i, i + 2));
  }

  const renderIcon = (c: DbLiveDraftUnavailableChampion, borderClass?: string) => {
    const name = getChampionById(c.champion_id)?.name ?? c.champion_id;
    return (
      <div
        key={c.id}
        className={`w-8 shrink min-w-0 ${borderClass ?? ''}`}
        style={iconStyle}
        title={name}
      >
        <img
          src={getIconUrl(c.champion_id) || undefined}
          alt={name}
          className="w-full aspect-square rounded border border-gray-700"
          loading="lazy"
        />
      </div>
    );
  };

  const wrapped = rows.length > 1;

  return (
    <div className="flex flex-col items-center px-4 py-2 bg-lol-card/50 border-y border-lol-border/30 gap-1.5">
      {rows.map((rowGames, rowIdx) => (
        <div key={rowIdx} className="flex items-center justify-center gap-3 w-full max-w-[1800px]">
          {rowGames.map(([gameNum, champions]) => (
            <div
              key={gameNum}
              className={`flex items-center gap-2 ${
                wrapped ? 'bg-white/[0.03] rounded-lg py-1.5 px-3 border border-white/[0.04]' : ''
              }`}
            >
              {/* Divider with game label */}
              <div className="flex flex-col items-center self-stretch">
                <div className="w-px flex-1 bg-lol-border/30" />
                <span className="text-[9px] text-gray-500 font-medium leading-none my-0.5">G{gameNum}</span>
                <div className="w-px flex-1 bg-lol-border/30" />
              </div>

              {/* Champion icons */}
              <div className="flex items-center gap-0.5 min-w-0">
                {draftMode === 'fearless' ? (
                  <>
                    <div className="flex items-center gap-0.5 shrink min-w-0">
                      {champions.filter(c => c.team === 'blue').map(c =>
                        renderIcon(c, 'border-b-2 border-blue-400/50 rounded-b')
                      )}
                    </div>
                    <div className="w-3 shrink-0" />
                    <div className="flex items-center gap-0.5 shrink min-w-0">
                      {champions.filter(c => c.team === 'red').map(c =>
                        renderIcon(c, 'border-b-2 border-red-400/50 rounded-b')
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-0.5 shrink min-w-0">
                    {champions.map(c => renderIcon(c))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
