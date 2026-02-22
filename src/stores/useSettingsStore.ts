import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Region, DEFAULT_REGION } from '../types';

interface SettingsState {
  // Region settings
  defaultRegion: Region;
  setDefaultRegion: (region: Region) => void;

  // Onboarding state
  hasCompletedOnboarding: boolean;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      defaultRegion: DEFAULT_REGION,
      setDefaultRegion: (region) => set({ defaultRegion: region }),

      hasCompletedOnboarding: false,
      completeOnboarding: () => set({ hasCompletedOnboarding: true }),
      resetOnboarding: () => set({ hasCompletedOnboarding: false }),
    }),
    {
      name: 'teamcomp-lol-settings',
      version: 1,
    }
  )
);
