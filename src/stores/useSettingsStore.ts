import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Region, DEFAULT_REGION } from '../types';
import { cloudSync } from './middleware/cloudSync';

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
    cloudSync(
      (set) => ({
        defaultRegion: DEFAULT_REGION,
        setDefaultRegion: (region) => set({ defaultRegion: region }),

        hasCompletedOnboarding: false,
        completeOnboarding: () => set({ hasCompletedOnboarding: true }),
        resetOnboarding: () => set({ hasCompletedOnboarding: false }),
      }),
      {
        storeKey: 'settings',
        tableName: 'user_settings',
        debounceMs: 1000,
        selectSyncData: (state) => ({
          defaultRegion: state.defaultRegion,
          hasCompletedOnboarding: state.hasCompletedOnboarding,
        }),
        transformForCloud: (data, userId) => ({
          user_id: userId,
          default_region: data.defaultRegion,
          has_completed_onboarding: data.hasCompletedOnboarding,
        }),
      }
    ),
    {
      name: 'teamcomp-lol-settings',
      version: 1,
    }
  )
);
