import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

export const useCustomTemplatesStore = create<CustomTemplatesState>()(
  persist(
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
      name: 'teamcomp-lol-custom-templates',
    }
  )
);
