import { useState, useEffect, useRef, useMemo } from "react";
import { getChampions, getLatestVersion, getChampionIconUrlSync } from "../../lib/datadragon";
import type { Champion } from "../../types";

interface ChampionAvatarModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (avatarUrl: string) => void;
  onUploadClick?: () => void;
  isLoading?: boolean;
}

type View = "choose" | "champions";

export default function ChampionAvatarModal({
  isOpen,
  onClose,
  onSelect,
  onUploadClick,
  isLoading = false,
}: ChampionAvatarModalProps) {
  const [champions, setChampions] = useState<Champion[]>([]);
  const [version, setVersion] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loadingData, setLoadingData] = useState(true);
  const [view, setView] = useState<View>("choose");
  const overlayRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Reset state on open
  useEffect(() => {
    if (!isOpen) return;
    setSearch("");
    setView(onUploadClick ? "choose" : "champions");
    setLoadingData(true);

    Promise.all([getChampions(), getLatestVersion()]).then(([champs, ver]) => {
      setChampions(champs);
      setVersion(ver);
      setLoadingData(false);
    });
  }, [isOpen, onUploadClick]);

  // Focus search when entering champions view
  useEffect(() => {
    if (isOpen && view === "champions" && !loadingData) {
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [isOpen, view, loadingData]);

  // Escape to close
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isLoading) {
        if (view === "champions" && onUploadClick) {
          setView("choose");
          setSearch("");
        } else {
          onClose();
        }
      }
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose, isLoading, view, onUploadClick]);

  const filtered = useMemo(() => {
    if (!search.trim()) return champions;
    const q = search.toLowerCase();
    return champions.filter((c) => c.name.toLowerCase().includes(q));
  }, [champions, search]);

  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current && !isLoading) onClose();
  };

  const handleSelect = (champ: Champion) => {
    if (!version || isLoading) return;
    const url = getChampionIconUrlSync(version, champ.id);
    onSelect(url);
  };

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
    >
      <div
        className={`${view === "choose" ? "max-w-xs" : "max-w-sm"} w-full mx-4 bg-lol-card border border-lol-border rounded-2xl shadow-2xl shadow-black/50 flex flex-col ${view === "champions" ? "max-h-[70vh]" : ""}`}
      >
        {view === "choose" ? (
          // ── Choose view ──
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-white">Change Avatar</h3>
              <button
                onClick={onClose}
                className="text-gray-500 hover:text-gray-300 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setView("champions")}
                className="flex flex-col items-center gap-2.5 p-4 rounded-xl border border-lol-border bg-lol-surface/30 hover:border-lol-gold/40 hover:bg-lol-gold/5 transition-colors group"
              >
                <div className="w-10 h-10 rounded-lg bg-lol-gold/10 flex items-center justify-center group-hover:bg-lol-gold/20 transition-colors">
                  <svg className="w-5 h-5 text-lol-gold" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                  </svg>
                </div>
                <div className="text-center">
                  <div className="text-sm font-medium text-white">Champion Icon</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">Pick from all champions</div>
                </div>
              </button>

              <button
                onClick={() => {
                  onClose();
                  onUploadClick?.();
                }}
                disabled={isLoading}
                className="flex flex-col items-center gap-2.5 p-4 rounded-xl border border-lol-border bg-lol-surface/30 hover:border-lol-gold/40 hover:bg-lol-gold/5 transition-colors group disabled:opacity-50"
              >
                <div className="w-10 h-10 rounded-lg bg-lol-gold/10 flex items-center justify-center group-hover:bg-lol-gold/20 transition-colors">
                  <svg className="w-5 h-5 text-lol-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="text-center">
                  <div className="text-sm font-medium text-white">Upload Your Own</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">Max 10MB, 256x256</div>
                </div>
              </button>
            </div>
          </div>
        ) : (
          // ── Champions grid view ──
          <>
            <div className="p-4 pb-3 border-b border-lol-border/50">
              <div className="flex items-center gap-2 mb-2">
                {onUploadClick && (
                  <button
                    onClick={() => { setView("choose"); setSearch(""); }}
                    className="text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                )}
                <h3 className="text-base font-semibold text-white flex-1">Choose Champion</h3>
                <button
                  onClick={onClose}
                  disabled={isLoading}
                  className="text-gray-500 hover:text-gray-300 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="relative">
                <svg
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  ref={searchRef}
                  type="text"
                  placeholder="Search champions..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs bg-lol-surface border border-lol-border text-white placeholder-gray-500 focus:border-lol-gold/50 focus:outline-none"
                />
              </div>
            </div>

            <div className="p-3 overflow-y-auto flex-1 min-h-0">
              {loadingData ? (
                <div className="flex items-center justify-center py-8">
                  <svg className="w-5 h-5 text-gray-500 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-xs">
                  No champions found
                </div>
              ) : (
                <div className="grid grid-cols-7 gap-1">
                  {filtered.map((champ) => (
                    <button
                      key={champ.id}
                      onClick={() => handleSelect(champ)}
                      disabled={isLoading}
                      className="group/champ flex flex-col items-center gap-0.5 p-1 rounded-md hover:bg-lol-surface/80 transition-colors disabled:opacity-50"
                      title={champ.name}
                    >
                      <div className="w-10 h-10 rounded-md overflow-hidden border border-lol-border/50 group-hover/champ:border-lol-gold/50 transition-colors">
                        <img
                          src={version ? getChampionIconUrlSync(version, champ.id) : ""}
                          alt={champ.name}
                          className="w-full h-full object-cover scale-110"
                          loading="lazy"
                        />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
