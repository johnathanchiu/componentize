import { create } from 'zustand';
import type { CanvasComponent, Interaction, CanvasLayout } from '../types/index';
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
  updateNaturalSize: (id: string, width: number, height: number) => void;
  clearSize: (id: string) => void;
  removeFromCanvas: (id: string) => void;
  clearCanvas: () => void;

  // Canvas layouts
  canvasLayouts: CanvasLayout[];
  addLayout: (layout: CanvasLayout) => void;
  updateLayoutPosition: (id: string, x: number, y: number) => void;
  updateLayoutSize: (id: string, width: number, height: number) => void;
  removeLayout: (id: string) => void;

  // Selection (can be component or layout)
  selectedComponentId: string | null;
  selectedLayoutId: string | null;
  setSelectedComponentId: (id: string | null) => void;
  setSelectedLayoutId: (id: string | null) => void;

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

  setCanvasDirectly: (components, projectId) =>
    set({
      canvasComponents: components,
      currentProjectId: projectId,
      isLoadingCanvas: false,
      canvasLoadError: null,
    }),

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

  updateNaturalSize: (id, width, height) =>
    set((state) => {
      const newComponents = state.canvasComponents.map((comp) => {
        if (comp.id === id) {
          // Update naturalSize (allows dynamic content changes to update node bounds)
          return { ...comp, naturalSize: { width, height } };
        }
        return comp;
      });
      if (state.currentProjectId) {
        debouncedSave(state.currentProjectId, newComponents);
      }
      return { canvasComponents: newComponents };
    }),

  // Clear explicit size - component will render at natural size
  clearSize: (id) =>
    set((state) => {
      const newComponents = state.canvasComponents.map((comp) => {
        if (comp.id === id) {
          // Remove size to let component render naturally
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

  clearCanvas: () => set({ canvasComponents: [], canvasLayouts: [] }),

  // Canvas layouts
  canvasLayouts: [],

  addLayout: (layout) =>
    set((state) => {
      const newLayouts = [...state.canvasLayouts, layout];
      // TODO: Add debounced save for layouts when we have full canvas state persistence
      return { canvasLayouts: newLayouts };
    }),

  updateLayoutPosition: (id, x, y) =>
    set((state) => {
      const newLayouts = state.canvasLayouts.map((layout) =>
        layout.id === id ? { ...layout, position: { x, y } } : layout
      );
      return { canvasLayouts: newLayouts };
    }),

  updateLayoutSize: (id, width, height) =>
    set((state) => {
      const newLayouts = state.canvasLayouts.map((layout) =>
        layout.id === id ? { ...layout, size: { width, height } } : layout
      );
      return { canvasLayouts: newLayouts };
    }),

  removeLayout: (id) =>
    set((state) => ({
      canvasLayouts: state.canvasLayouts.filter((layout) => layout.id !== id),
      selectedLayoutId: state.selectedLayoutId === id ? null : state.selectedLayoutId,
    })),

  // Selection
  selectedComponentId: null,
  selectedLayoutId: null,
  setSelectedComponentId: (id) => set({ selectedComponentId: id, selectedLayoutId: null }),
  setSelectedLayoutId: (id) => set({ selectedLayoutId: id, selectedComponentId: null }),

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
