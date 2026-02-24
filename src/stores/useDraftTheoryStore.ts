import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { cloudSync } from './middleware/cloudSync';

type DraftSide = 'blue' | 'red';
type SlotType = 'ban' | 'pick';

interface SlotLocation {
  side: DraftSide;
  type: SlotType;
  index: number;
}

interface DraftTheoryState {
  blueBans: (string | null)[];
  bluePicks: (string | null)[];
  redBans: (string | null)[];
  redPicks: (string | null)[];
  blueTeamName: string;
  redTeamName: string;

  setSlot: (side: DraftSide, type: SlotType, index: number, championId: string | null) => void;
  swapSlots: (from: SlotLocation, to: SlotLocation) => void;
  clearSlot: (side: DraftSide, type: SlotType, index: number) => void;
  clearSide: (side: DraftSide) => void;
  clearAll: () => void;
  getAllUsedChampionIds: () => string[];
  isChampionUsed: (championId: string) => boolean;
  setTeamName: (side: DraftSide, name: string) => void;
}

const createEmptySlots = (): (string | null)[] => [null, null, null, null, null];

const initialState = {
  blueBans: createEmptySlots(),
  bluePicks: createEmptySlots(),
  redBans: createEmptySlots(),
  redPicks: createEmptySlots(),
  blueTeamName: 'Blue Side',
  redTeamName: 'Red Side',
};

type SlotKey = 'blueBans' | 'bluePicks' | 'redBans' | 'redPicks';

const getSlotKey = (side: DraftSide, type: SlotType): SlotKey => {
  return `${side}${type.charAt(0).toUpperCase() + type.slice(1)}s` as SlotKey;
};

export const useDraftTheoryStore = create<DraftTheoryState>()(
  persist(
    cloudSync(
      (set, get) => ({
      ...initialState,

      setSlot: (side, type, index, championId) => {
        const key = getSlotKey(side, type);
        set((state) => ({
          [key]: (state[key] as (string | null)[]).map((id: string | null, i: number) => (i === index ? championId : id)),
        }));
      },

      swapSlots: (from, to) => {
        const state = get();
        const fromKey = getSlotKey(from.side, from.type);
        const toKey = getSlotKey(to.side, to.type);

        const fromArr = state[fromKey] as (string | null)[];
        const toArr = state[toKey] as (string | null)[];
        const fromChampion = fromArr[from.index];
        const toChampion = toArr[to.index];

        if (fromKey === toKey) {
          // Same array, need to update both indices at once
          set({
            [fromKey]: fromArr.map((id: string | null, i: number) => {
              if (i === from.index) return toChampion;
              if (i === to.index) return fromChampion;
              return id;
            }),
          });
        } else {
          // Different arrays
          set({
            [fromKey]: fromArr.map((id: string | null, i: number) => (i === from.index ? toChampion : id)),
            [toKey]: toArr.map((id: string | null, i: number) => (i === to.index ? fromChampion : id)),
          });
        }
      },

      clearSlot: (side, type, index) => {
        get().setSlot(side, type, index, null);
      },

      clearSide: (side) => {
        set({
          [`${side}Bans`]: createEmptySlots(),
          [`${side}Picks`]: createEmptySlots(),
        });
      },

      clearAll: () => set(initialState),

      getAllUsedChampionIds: () => {
        const state = get();
        return [
          ...state.blueBans,
          ...state.bluePicks,
          ...state.redBans,
          ...state.redPicks,
        ].filter((id): id is string => id !== null);
      },

      isChampionUsed: (championId) => {
        return get().getAllUsedChampionIds().includes(championId);
      },

      setTeamName: (side, name) => {
        set({ [`${side}TeamName`]: name });
      },
    }),
      {
        storeKey: 'draft-theory',
        tableName: 'draft_theory',
        debounceMs: 2000,
        selectSyncData: (state) => ({
          blueBans: state.blueBans,
          bluePicks: state.bluePicks,
          redBans: state.redBans,
          redPicks: state.redPicks,
          blueTeamName: state.blueTeamName,
          redTeamName: state.redTeamName,
        }),
        transformForCloud: (data, userId) => ({
          user_id: userId,
          blue_bans: data.blueBans,
          blue_picks: data.bluePicks,
          red_bans: data.redBans,
          red_picks: data.redPicks,
          blue_team_name: data.blueTeamName,
          red_team_name: data.redTeamName,
        }),
      }
    ),
    {
      name: 'teamcomp-lol-draft-theory',
    }
  )
);
