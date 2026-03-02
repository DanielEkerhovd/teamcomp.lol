# Champion Patch Tracker — Implementation Plan

## Overview
New tool tab that compares champion base stats between consecutive League patches using Data Dragon. Select a patch → see which champions had stat changes and what changed (old → new), with buff/nerf color coding.

## Files to Create/Modify

### 1. `src/types/index.ts` — Add types
```ts
export interface ChampionStats {
  hp: number; hpperlevel: number;
  mp: number; mpperlevel: number;
  movespeed: number;
  armor: number; armorperlevel: number;
  spellblock: number; spellblockperlevel: number;
  attackrange: number;
  hpregen: number; hpregenperlevel: number;
  mpregen: number; mpregenperlevel: number;
  crit: number; critperlevel: number;
  attackdamage: number; attackdamageperlevel: number;
  attackspeedperlevel: number; attackspeed: number;
}

export interface StatChange {
  stat: string;       // e.g. "hp"
  label: string;      // e.g. "Health"
  oldValue: number;
  newValue: number;
  direction: 'buff' | 'nerf';
}

export interface ChampionPatchChange {
  championId: string;
  championName: string;
  changes: StatChange[];
}
```

### 2. `src/lib/patchService.ts` — New service (core logic)

**Functions:**
- `getVersionList()` — Fetch & cache `ddragon/api/versions.json`
- `getPatchVersions(limit)` — Group versions by `major.minor`, pick latest subversion for each, return recent N patches (e.g. last 10)
- `getChampionStatsForVersion(version)` — Fetch `champion.json` for a specific version, return `Map<championId, ChampionStats>`. Cache per version in-memory.
- `getChampionNamesForVersion(version)` — Return `Map<championId, name>` from the same cached data
- `comparePatch(currentVersion, previousVersion)` — Diff all champions between two versions. Only return champions with at least one stat change. Also detect new champions (present in current but not previous).

**Stat label mapping:**
```ts
const STAT_LABELS: Record<string, string> = {
  hp: 'Health', hpperlevel: 'Health / Level',
  mp: 'Mana', mpperlevel: 'Mana / Level',
  movespeed: 'Move Speed',
  armor: 'Armor', armorperlevel: 'Armor / Level',
  spellblock: 'Magic Resist', spellblockperlevel: 'Magic Resist / Level',
  attackrange: 'Attack Range',
  hpregen: 'HP Regen', hpregenperlevel: 'HP Regen / Level',
  mpregen: 'Mana Regen', mpregenperlevel: 'Mana Regen / Level',
  crit: 'Crit', critperlevel: 'Crit / Level',
  attackdamage: 'Attack Damage', attackdamageperlevel: 'AD / Level',
  attackspeedperlevel: 'Attack Speed / Level', attackspeed: 'Attack Speed',
};
```

**Caching:** `Map<version, { stats, names }>` in module scope. Versions are immutable so cache never needs invalidation.

### 3. `src/components/tools/PatchTracker.tsx` — New component

**Layout:**
```
┌─────────────────────────────────────────────────┐
│ [Patch dropdown: v15.4 ▼]  [Search champions…]  │
├─────────────────────────────────────────────────┤
│                                                  │
│  🖼 Aatrox                                       │
│    Health: 650 → 680          (+30)  🟢 buff     │
│    Armor / Level: 4.45 → 4.2 (-0.25) 🔴 nerf    │
│                                                  │
│  🖼 Ahri                                         │
│    Mana: 418 → 440            (+22)  🟢 buff     │
│                                                  │
│  (empty state if no changes detected)            │
└─────────────────────────────────────────────────┘
```

**State:**
- `selectedPatch` — index into patch list (default 0 = latest)
- `searchQuery` — filter champions by name
- `loading` / `error` states
- `changes: ChampionPatchChange[]` — computed when patch selection changes

**Styling:** Uses existing `lol-*` theme classes. Buff = `text-green-400`, Nerf = `text-red-400`. Champion icons via `getChampionIconUrlSync()`.

### 4. `src/pages/ToolsPage.tsx` — Add tab

- Change type: `type ToolTab = 'draft-theory' | 'patch-tracker'`
- Add `setActiveTab` to the useState destructure
- Add tab button for "Patch Tracker"
- Add `onClick` handlers to both tab buttons
- Add conditional render: `{activeTab === 'patch-tracker' && <PatchTracker />}`

## Edge Cases
- **New champions:** Present in current version but not previous → show as "New Champion" instead of stat diffs
- **No changes:** Show friendly empty state ("No base stat changes detected for this patch")
- **Fetch failures:** Show error message with retry button
- **Version grouping:** Versions like "14.5.1" and "14.5.2" belong to the same patch; use latest subversion for comparison
