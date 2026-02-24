import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { cloudSync } from './middleware/cloudSync';
import { generateId } from '../types';

export interface CustomTemplate {
  id: string;
  name: string;
  groups: string[];
  allowDuplicates: boolean;
}

interface CustomTemplatesState {
  templates: CustomTemplate[];
  addTemplate: (name: string, groups: string[], allowDuplicates: boolean) => void;
  removeTemplate: (id: string) => void;
}

export const useCustomTemplatesStore = create<CustomTemplatesState>()(
  persist(
    cloudSync(
      (set) => ({
        templates: [],

        addTemplate: (name: string, groups: string[], allowDuplicates: boolean) => {
          set((state) => ({
            templates: [
              ...state.templates,
              { id: generateId(), name, groups, allowDuplicates },
            ],
          }));
        },

        removeTemplate: (id: string) => {
          set((state) => ({
            templates: state.templates.filter((t) => t.id !== id),
          }));
        },
      }),
      {
        storeKey: 'custom-templates',
        tableName: 'custom_templates',
        isArraySync: true,
        selectSyncData: (state) => state.templates,
        transformItem: (template: CustomTemplate, userId: string, index: number) => ({
          id: template.id,
          user_id: userId,
          name: template.name,
          groups: template.groups,
          allow_duplicates: template.allowDuplicates,
          sort_order: index,
        }),
      }
    ),
    {
      name: 'teamcomp-lol-custom-templates',
    }
  )
);
