import { create } from 'zustand';
import type { CanvasComponent, Interaction } from '../types/index';
import { getProjectCanvas, saveProjectCanvas } from '../lib/api';
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

  // Canvas items
  canvasComponents: CanvasComponent[];
  isLoadingCanvas: boolean;
  canvasLoadError: string | null;
  addToCanvas: (component: CanvasComponent) => void;
  updatePosition: (id: string, x: number, y: number) => void;
  updateSize: (id: string, width: number, height: number, x?: number, y?: number) => void;
  removeFromCanvas: (id: string) => void;
  clearCanvas: () => void;
  loadCanvas: (projectId: string) => Promise<void>;

  // Selection
  selectedComponentId: string | null;
  setSelectedComponentId: (id: string | null) => void;

  // Interactions
  addInteraction: (componentId: string, interaction: Interaction) => void;
  removeInteraction: (componentId: string, interactionId: string) => void;
  updateInteraction: (componentId: string, interactionId: string, updates: Partial<Interaction>) => void;

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

  loadCanvas: async (projectId) => {
    set({ isLoadingCanvas: true, canvasLoadError: null });
    try {
      const result = await getProjectCanvas(projectId);
      if (result.status === 'success') {
        set({
          canvasComponents: result.components,
          currentProjectId: projectId,
          isLoadingCanvas: false,
        });
      } else {
        throw new Error('Failed to load canvas');
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error loading canvas';
      console.error('Failed to load canvas:', e);
      set({
        canvasLoadError: errorMessage,
        canvasComponents: [],
        currentProjectId: projectId,
        isLoadingCanvas: false,
      });
    }
  },

  addToCanvas: (component) =>
    set((state) => {
      const newComponents = [...state.canvasComponents, component];
      if (state.currentProjectId) {
        debouncedSave(state.currentProjectId, newComponents);
      }
      return { canvasComponents: newComponents };
    }),

  updatePosition: (id, x, y) =>
    set((state) => {
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

  removeFromCanvas: (id) =>
    set((state) => {
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

  // Interactions
  addInteraction: (componentId, interaction) =>
    set((state) => ({
      canvasComponents: state.canvasComponents.map((comp) =>
        comp.id === componentId
          ? { ...comp, interactions: [...(comp.interactions || []), interaction] }
          : comp
      ),
    })),

  removeInteraction: (componentId, interactionId) =>
    set((state) => ({
      canvasComponents: state.canvasComponents.map((comp) =>
        comp.id === componentId
          ? { ...comp, interactions: comp.interactions?.filter((i) => i.id !== interactionId) }
          : comp
      ),
    })),

  updateInteraction: (componentId, interactionId, updates) =>
    set((state) => ({
      canvasComponents: state.canvasComponents.map((comp) =>
        comp.id === componentId
          ? {
            ...comp,
            interactions: comp.interactions?.map((i) =>
              i.id === interactionId ? { ...i, ...updates } : i
            ),
          }
          : comp
      ),
    })),

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
