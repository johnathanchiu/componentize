import { create } from 'zustand';
import type { Component } from '../types/index';

interface ComponentLibraryStore {
  availableComponents: Component[];
  setAvailableComponents: (components: Component[]) => void;
  addAvailableComponent: (component: Component) => void;
  removeAvailableComponent: (componentName: string) => void;
}

export const useComponentLibraryStore = create<ComponentLibraryStore>((set) => ({
  availableComponents: [],

  setAvailableComponents: (components) => set({ availableComponents: components }),

  addAvailableComponent: (component) =>
    set((state) => ({
      availableComponents: [...state.availableComponents, component],
    })),

  removeAvailableComponent: (componentName) =>
    set((state) => ({
      availableComponents: state.availableComponents.filter((c) => c.name !== componentName),
    })),
}));
