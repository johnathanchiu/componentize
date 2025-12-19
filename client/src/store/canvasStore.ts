import { create } from 'zustand';
import type { CanvasComponent } from '../types/index';
import { saveProjectCanvas } from '../lib/api';
import type { StateConnection } from '../lib/sharedStore';

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

interface CanvasStore {
  // Current project ID (for persistence)
  currentProjectId: string | null;
  setCurrentProjectId: (id: string | null) => void;

  // Canvas items (components)
  canvasComponents: CanvasComponent[];
  isLoadingCanvas: boolean;
  canvasLoadError: string | null;
  setCanvasDirectly: (components: CanvasComponent[], projectId: string) => void;
  addToCanvas: (component: CanvasComponent) => void;
  updatePosition: (id: string, x: number, y: number) => void;
  updateSize: (id: string, width: number, height: number, x?: number, y?: number) => void;
  clearSize: (id: string) => void;
  removeFromCanvas: (id: string) => void;
  clearCanvas: () => void;

  // Selection
  selectedComponentId: string | null;
  setSelectedComponentId: (id: string | null) => void;

  // State connections (for visual connection lines)
  stateConnections: StateConnection[];
  showConnections: boolean;
  setStateConnections: (connections: StateConnection[]) => void;
  addStateConnections: (connections: StateConnection[]) => void;
  removeComponentConnections: (componentId: string) => void;
  setShowConnections: (show: boolean) => void;
  toggleShowConnections: () => void;
}

export const useCanvasStore = create<CanvasStore>((set) => ({
  // Current project ID
  currentProjectId: null,
  setCurrentProjectId: (id) => set({ currentProjectId: id }),

  // Canvas items
  canvasComponents: [],
  isLoadingCanvas: false,
  canvasLoadError: null,

  setCanvasDirectly: (components, projectId) =>
    set({
      canvasComponents: components,
      currentProjectId: projectId,
      isLoadingCanvas: false,
      canvasLoadError: null,
    }),

  addToCanvas: (component) =>
    set((state) => {
      console.log('[Canvas] addToCanvas:', component.componentName, 'at', component.position);
      const newComponents = [...state.canvasComponents, component];
      if (state.currentProjectId) {
        debouncedSave(state.currentProjectId, newComponents);
      }
      return { canvasComponents: newComponents };
    }),

  updatePosition: (id, x, y) =>
    set((state) => {
      const comp = state.canvasComponents.find((c) => c.id === id);
      console.log('[Canvas] updatePosition:', comp?.componentName, 'to', { x, y });
      const newComponents = state.canvasComponents.map((comp) =>
        comp.id === id ? { ...comp, position: { x, y } } : comp
      );
      if (state.currentProjectId) {
        debouncedSave(state.currentProjectId, newComponents);
      }
      return { canvasComponents: newComponents };
    }),

  updateSize: (id, width, height, x, y) =>
    set((state) => {
      const comp = state.canvasComponents.find((c) => c.id === id);
      console.log('[Canvas] updateSize:', comp?.componentName, 'to', { width, height }, x !== undefined ? `pos: ${x}, ${y}` : '');
      const newComponents = state.canvasComponents.map((comp) => {
        if (comp.id === id) {
          const updates: Partial<CanvasComponent> = { size: { width, height } };
          if (x !== undefined && y !== undefined) {
            updates.position = { x, y };
          }
          return { ...comp, ...updates };
        }
        return comp;
      });
      if (state.currentProjectId) {
        debouncedSave(state.currentProjectId, newComponents);
      }
      return { canvasComponents: newComponents };
    }),

  clearSize: (id) =>
    set((state) => {
      const newComponents = state.canvasComponents.map((comp) => {
        if (comp.id === id) {
          const { size, ...rest } = comp;
          return rest;
        }
        return comp;
      });
      if (state.currentProjectId) {
        debouncedSave(state.currentProjectId, newComponents);
      }
      return { canvasComponents: newComponents };
    }),

  removeFromCanvas: (id) =>
    set((state) => {
      const comp = state.canvasComponents.find((c) => c.id === id);
      console.log('[Canvas] removeFromCanvas:', comp?.componentName);
      const newComponents = state.canvasComponents.filter((comp) => comp.id !== id);
      const newConnections = state.stateConnections.filter((c) => c.componentId !== id);

      if (state.currentProjectId) {
        debouncedSave(state.currentProjectId, newComponents);
      }
      return {
        canvasComponents: newComponents,
        stateConnections: newConnections,
      };
    }),

  clearCanvas: () => set({ canvasComponents: [] }),

  // Selection
  selectedComponentId: null,
  setSelectedComponentId: (id) => set({ selectedComponentId: id }),

  // State connections
  stateConnections: [],
  showConnections: false,

  setStateConnections: (connections) => set({ stateConnections: connections }),

  addStateConnections: (connections) =>
    set((state) => {
      const componentIds = new Set(connections.map((c) => c.componentId));
      const filtered = state.stateConnections.filter((c) => !componentIds.has(c.componentId));
      return { stateConnections: [...filtered, ...connections] };
    }),

  removeComponentConnections: (componentId) =>
    set((state) => ({
      stateConnections: state.stateConnections.filter((c) => c.componentId !== componentId),
    })),

  setShowConnections: (show) => set({ showConnections: show }),
  toggleShowConnections: () => set((state) => ({ showConnections: !state.showConnections })),
}));
