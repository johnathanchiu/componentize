import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import type { CanvasComponent } from '@/shared/types';
import { saveProjectCanvas } from '../../lib/api';
import type { StateConnection } from '../../lib/sharedStore';

// Per-project debounce for saving canvas (avoids cross-project collisions)
const saveTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

const debouncedSave = (projectId: string, components: CanvasComponent[]) => {
  const existingTimeout = saveTimeouts.get(projectId);
  if (existingTimeout) clearTimeout(existingTimeout);

  const timeoutId = setTimeout(() => {
    saveProjectCanvas(projectId, components).catch((e) => {
      console.error(`Failed to save canvas for project ${projectId}:`, e);
    });
    saveTimeouts.delete(projectId);
  }, 500);

  saveTimeouts.set(projectId, timeoutId);
};

// Maximum history entries to prevent memory bloat
const MAX_HISTORY = 50;

interface CanvasState {
  // Current project ID (for persistence)
  currentProjectId: string | null;

  // Canvas items (components)
  components: CanvasComponent[];
  isLoading: boolean;
  loadError: string | null;

  // Undo/Redo history (session-only, not persisted)
  history: CanvasComponent[][];
  future: CanvasComponent[][];

  // Selection
  selectedId: string | null;

  // State connections (for visual connection lines)
  connections: StateConnection[];
  showConnections: boolean;
}

interface CanvasActions {
  // Project
  setProjectId: (id: string | null) => void;

  // Components
  setComponents: (components: CanvasComponent[], projectId: string) => void;
  add: (component: CanvasComponent) => void;
  remove: (id: string) => void;
  updatePosition: (id: string, x: number, y: number) => void;
  updateSize: (id: string, width: number, height: number, x?: number, y?: number) => void;
  clearSize: (id: string) => void;
  clear: () => void;

  // History
  pushToHistory: () => void;
  undo: () => void;
  redo: () => void;

  // Selection
  select: (id: string | null) => void;

  // Connections
  setConnections: (connections: StateConnection[]) => void;
  addConnections: (connections: StateConnection[]) => void;
  removeComponentConnections: (componentId: string) => void;
  setShowConnections: (show: boolean) => void;
  toggleConnections: () => void;
}

export type CanvasStore = CanvasState & CanvasActions;

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  // State
  currentProjectId: null,
  components: [],
  isLoading: false,
  loadError: null,
  history: [],
  future: [],
  selectedId: null,
  connections: [],
  showConnections: false,

  // Project
  setProjectId: (id) => set({ currentProjectId: id }),

  // Components
  setComponents: (components, projectId) =>
    set({
      components,
      currentProjectId: projectId,
      isLoading: false,
      loadError: null,
      history: [],
      future: [],
    }),

  add: (component) => {
    // Check for duplicates by componentName (server already added it)
    const existing = get().components.find((c) => c.componentName === component.componentName);
    if (existing) return;

    get().pushToHistory();
    set((state) => ({ components: [...state.components, component] }));
  },

  remove: (id) => {
    get().pushToHistory();
    set((state) => {
      const newComponents = state.components.filter((c) => c.id !== id);
      const newConnections = state.connections.filter((c) => c.componentId !== id);

      if (state.currentProjectId) {
        debouncedSave(state.currentProjectId, newComponents);
      }
      return {
        components: newComponents,
        connections: newConnections,
      };
    });
  },

  updatePosition: (id, x, y) =>
    set((state) => {
      const newComponents = state.components.map((c) =>
        c.id === id ? { ...c, position: { x, y } } : c
      );
      if (state.currentProjectId) {
        debouncedSave(state.currentProjectId, newComponents);
      }
      return { components: newComponents };
    }),

  updateSize: (id, width, height, x, y) => {
    get().pushToHistory();
    set((state) => {
      const newComponents = state.components.map((c) => {
        if (c.id === id) {
          const updates: Partial<CanvasComponent> = { size: { width, height } };
          if (x !== undefined && y !== undefined) {
            updates.position = { x, y };
          }
          return { ...c, ...updates };
        }
        return c;
      });
      if (state.currentProjectId) {
        debouncedSave(state.currentProjectId, newComponents);
      }
      return { components: newComponents };
    });
  },

  clearSize: (id) => {
    get().pushToHistory();
    set((state) => {
      const newComponents = state.components.map((c) => {
        if (c.id === id) {
          const { size, ...rest } = c;
          return rest;
        }
        return c;
      });
      if (state.currentProjectId) {
        debouncedSave(state.currentProjectId, newComponents);
      }
      return { components: newComponents };
    });
  },

  clear: () => set({ components: [], history: [], future: [] }),

  // History
  pushToHistory: () =>
    set((state) => ({
      history: [...state.history.slice(-(MAX_HISTORY - 1)), state.components],
      future: [],
    })),

  undo: () => {
    const state = get();
    if (state.history.length === 0) return;

    const previous = state.history[state.history.length - 1];
    const newHistory = state.history.slice(0, -1);

    if (state.currentProjectId) {
      debouncedSave(state.currentProjectId, previous);
    }

    set({
      components: previous,
      history: newHistory,
      future: [state.components, ...state.future],
    });
  },

  redo: () => {
    const state = get();
    if (state.future.length === 0) return;

    const next = state.future[0];
    const newFuture = state.future.slice(1);

    if (state.currentProjectId) {
      debouncedSave(state.currentProjectId, next);
    }

    set({
      components: next,
      history: [...state.history, state.components],
      future: newFuture,
    });
  },

  // Selection
  select: (id) => set({ selectedId: id }),

  // Connections
  setConnections: (connections) => set({ connections }),

  addConnections: (connections) =>
    set((state) => {
      const componentIds = new Set(connections.map((c) => c.componentId));
      const filtered = state.connections.filter((c) => !componentIds.has(c.componentId));
      return { connections: [...filtered, ...connections] };
    }),

  removeComponentConnections: (componentId) =>
    set((state) => ({
      connections: state.connections.filter((c) => c.componentId !== componentId),
    })),

  setShowConnections: (show) => set({ showConnections: show }),
  toggleConnections: () => set((state) => ({ showConnections: !state.showConnections })),
}));

// ============================================================================
// Selector Hooks - Use these instead of destructuring the store directly
// ============================================================================

// State selectors (one per value - only re-renders when that value changes)
export const useCanvasComponents = () => useCanvasStore((s) => s.components);
export const useSelectedId = () => useCanvasStore((s) => s.selectedId);
export const useConnections = () => useCanvasStore((s) => s.connections);
export const useShowConnections = () => useCanvasStore((s) => s.showConnections);
export const useCanvasIsLoading = () => useCanvasStore((s) => s.isLoading);
export const useCanvasLoadError = () => useCanvasStore((s) => s.loadError);
export const useCanvasProjectId = () => useCanvasStore((s) => s.currentProjectId);

// Actions (grouped - use useShallow to prevent infinite loops from object creation)
export const useCanvasActions = () => useCanvasStore(
  useShallow((s) => ({
    setProjectId: s.setProjectId,
    setComponents: s.setComponents,
    add: s.add,
    remove: s.remove,
    updatePosition: s.updatePosition,
    updateSize: s.updateSize,
    clearSize: s.clearSize,
    clear: s.clear,
    pushToHistory: s.pushToHistory,
    undo: s.undo,
    redo: s.redo,
    select: s.select,
    setConnections: s.setConnections,
    addConnections: s.addConnections,
    removeComponentConnections: s.removeComponentConnections,
    setShowConnections: s.setShowConnections,
    toggleConnections: s.toggleConnections,
  }))
);
