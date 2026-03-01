// Champion splash art facing direction
// Data is stored in Supabase `champion_facing` table, editable via /splasharts (developer only).
// Static fallback is used before the DB fetch completes or when offline.

import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export type Facing = 'left' | 'right';

// ─── Static fallback (used before DB loads / offline) ──────────────────
const FALLBACK_FACING: Record<string, Facing> = {
  Aatrox: 'right',
  Ahri: 'right',
  Akali: 'right',
  Akshan: 'right',
  Alistar: 'right',
  Ambessa: 'right',
  Amumu: 'right',
  Anivia: 'right',
  Annie: 'right',
  Aphelios: 'right',
  Ashe: 'right',
  AurelionSol: 'right',
  Aurora: 'right',
  Azir: 'right',
  Bard: 'right',
  Belveth: 'right',
  Blitzcrank: 'right',
  Brand: 'right',
  Braum: 'right',
  Briar: 'right',
  Caitlyn: 'right',
  Camille: 'right',
  Cassiopeia: 'right',
  Chogath: 'right',
  Corki: 'right',
  Darius: 'right',
  Diana: 'right',
  Draven: 'right',
  DrMundo: 'right',
  Ekko: 'right',
  Elise: 'right',
  Evelynn: 'right',
  Ezreal: 'right',
  Fiddlesticks: 'right',
  Fiora: 'right',
  Fizz: 'right',
  Galio: 'right',
  Gangplank: 'right',
  Garen: 'right',
  Gnar: 'right',
  Gragas: 'right',
  Graves: 'right',
  Gwen: 'right',
  Hecarim: 'right',
  Heimerdinger: 'right',
  Hwei: 'right',
  Illaoi: 'right',
  Irelia: 'right',
  Ivern: 'right',
  Janna: 'right',
  JarvanIV: 'right',
  Jax: 'right',
  Jayce: 'right',
  Jhin: 'right',
  Jinx: 'right',
  Kaisa: 'right',
  Kalista: 'right',
  Karma: 'right',
  Karthus: 'right',
  Kassadin: 'right',
  Katarina: 'right',
  Kayle: 'right',
  Kayn: 'right',
  Kennen: 'right',
  Khazix: 'right',
  Kindred: 'right',
  Kled: 'right',
  KogMaw: 'right',
  KSante: 'right',
  Leblanc: 'right',
  LeeSin: 'right',
  Leona: 'right',
  Lillia: 'right',
  Lissandra: 'right',
  Lucian: 'right',
  Lulu: 'right',
  Lux: 'right',
  Malphite: 'right',
  Malzahar: 'right',
  Maokai: 'right',
  MasterYi: 'right',
  Mel: 'right',
  Milio: 'right',
  MissFortune: 'right',
  MonkeyKing: 'right',
  Mordekaiser: 'right',
  Morgana: 'right',
  Naafiri: 'right',
  Nami: 'right',
  Nasus: 'right',
  Nautilus: 'right',
  Neeko: 'right',
  Nidalee: 'right',
  Nilah: 'right',
  Nocturne: 'right',
  Nunu: 'right',
  Olaf: 'right',
  Orianna: 'right',
  Ornn: 'right',
  Pantheon: 'right',
  Poppy: 'right',
  Pyke: 'right',
  Qiyana: 'right',
  Quinn: 'right',
  Rakan: 'right',
  Rammus: 'right',
  RekSai: 'right',
  Rell: 'right',
  Renata: 'right',
  Renekton: 'right',
  Rengar: 'right',
  Riven: 'right',
  Rumble: 'right',
  Ryze: 'right',
  Samira: 'right',
  Sejuani: 'right',
  Senna: 'right',
  Seraphine: 'right',
  Sett: 'right',
  Shaco: 'right',
  Shen: 'right',
  Shyvana: 'right',
  Singed: 'right',
  Sion: 'right',
  Sivir: 'right',
  Skarner: 'right',
  Smolder: 'right',
  Sona: 'right',
  Soraka: 'right',
  Swain: 'right',
  Sylas: 'right',
  Syndra: 'right',
  TahmKench: 'right',
  Taliyah: 'right',
  Talon: 'right',
  Taric: 'right',
  Teemo: 'right',
  Thresh: 'right',
  Tristana: 'right',
  Trundle: 'right',
  Tryndamere: 'right',
  TwistedFate: 'right',
  Twitch: 'right',
  Udyr: 'right',
  Urgot: 'right',
  Varus: 'right',
  Vayne: 'right',
  Veigar: 'right',
  Velkoz: 'right',
  Vex: 'right',
  Vi: 'right',
  Viego: 'right',
  Viktor: 'right',
  Vladimir: 'right',
  Volibear: 'right',
  Warwick: 'right',
  Xayah: 'right',
  Xerath: 'right',
  XinZhao: 'right',
  Yasuo: 'right',
  Yone: 'right',
  Yorick: 'right',
  Yunara: 'right',
  Yuumi: 'right',
  Zaahen: 'right',
  Zac: 'right',
  Zed: 'right',
  Zeri: 'right',
  Ziggs: 'right',
  Zilean: 'right',
  Zoe: 'right',
  Zyra: 'right',
};

// ─── Zustand store ─────────────────────────────────────────────────────
interface ChampionFacingState {
  facingMap: Record<string, Facing>;
  isLoaded: boolean;
  fetchFacingData: () => Promise<void>;
  setChampionFacing: (championId: string, facing: Facing) => Promise<{ success: boolean; message?: string }>;
}

export const useChampionFacingStore = create<ChampionFacingState>()((set, get) => ({
  facingMap: { ...FALLBACK_FACING },
  isLoaded: false,

  fetchFacingData: async () => {
    if (!supabase) {
      set({ isLoaded: true });
      return;
    }

    const { data, error } = await (supabase as any)
      .from('champion_facing')
      .select('champion_id, facing');

    if (error) {
      console.error('Failed to fetch champion facing data:', error);
      set({ isLoaded: true });
      return;
    }

    const merged: Record<string, Facing> = { ...FALLBACK_FACING };
    if (data) {
      for (const row of data as { champion_id: string; facing: Facing }[]) {
        merged[row.champion_id] = row.facing;
      }
    }

    set({ facingMap: merged, isLoaded: true });
  },

  setChampionFacing: async (championId: string, facing: Facing) => {
    if (!supabase) {
      return { success: false, message: 'Supabase not configured' };
    }

    // Optimistic update
    const prev = get().facingMap;
    set({ facingMap: { ...prev, [championId]: facing } });

    const { data, error } = await (supabase as any).rpc('upsert_champion_facing', {
      p_champion_id: championId,
      p_facing: facing,
    });

    if (error) {
      set({ facingMap: prev });
      return { success: false, message: error.message };
    }

    const result = data as { success: boolean; message?: string };
    if (!result.success) {
      set({ facingMap: prev });
    }

    return result;
  },
}));

// Fire-and-forget fetch on module load — store is usable immediately with fallback data
useChampionFacingStore.getState().fetchFacingData();

// ─── Synchronous public API (unchanged signatures for DraftSlotLive) ───
export function getChampionFacing(championId: string): Facing {
  return useChampionFacingStore.getState().facingMap[championId] || 'right';
}

export function shouldFlipSplash(championId: string, side: 'blue' | 'red'): boolean {
  const facing = getChampionFacing(championId);
  if (side === 'blue') return facing === 'left';
  if (side === 'red') return facing === 'right';
  return false;
}
