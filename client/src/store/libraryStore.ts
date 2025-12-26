import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import type { Component } from '@/shared/types';

interface LibraryState {
  // Available components in the current project
  components: Component[];

  // Broken components that need fixing (componentName -> error message)
  brokenComponents: Record<string, string>;
}

interface LibraryActions {
  setComponents: (components: Component[]) => void;
  addComponent: (component: Component) => void;
  removeComponent: (componentName: string) => void;

  // Broken component tracking
  setBroken: (componentName: string, error: string) => void;
  clearBroken: (componentName: string) => void;
  clearAllBroken: () => void;
}

export type LibraryStore = LibraryState & LibraryActions;

export const useLibraryStore = create<LibraryStore>((set) => ({
  // State
  components: [],
  brokenComponents: {},

  // Actions
  setComponents: (components) => set({ components }),

  addComponent: (component) =>
    set((state) => ({
      components: [...state.components, component],
    })),

  removeComponent: (componentName) =>
    set((state) => {
      const { [componentName]: _, ...restBroken } = state.brokenComponents;
      return {
        components: state.components.filter((c) => c.name !== componentName),
        brokenComponents: restBroken,
      };
    }),

  // Broken component tracking
  setBroken: (componentName, error) =>
    set((state) => ({
      brokenComponents: { ...state.brokenComponents, [componentName]: error },
    })),

  clearBroken: (componentName) =>
    set((state) => {
      const { [componentName]: _, ...restBroken } = state.brokenComponents;
      return { brokenComponents: restBroken };
    }),

  clearAllBroken: () => set({ brokenComponents: {} }),
}));

// ============================================================================
// Selector Hooks - Use these instead of destructuring the store directly
// ============================================================================

// State selectors (one per value - only re-renders when that value changes)
export const useLibraryComponents = () => useLibraryStore((s) => s.components);
export const useBrokenComponents = () => useLibraryStore((s) => s.brokenComponents);

// Actions (grouped - use useShallow to prevent infinite loops from object creation)
export const useLibraryActions = () => useLibraryStore(
  useShallow((s) => ({
    setComponents: s.setComponents,
    addComponent: s.addComponent,
    removeComponent: s.removeComponent,
    setBroken: s.setBroken,
    clearBroken: s.clearBroken,
    clearAllBroken: s.clearAllBroken,
  }))
);
