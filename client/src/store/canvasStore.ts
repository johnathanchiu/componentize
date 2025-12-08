import { create } from 'zustand';
import type { Component, CanvasComponent, Interaction, StreamEvent, StreamStatus } from '../types/index';
import { getProjectCanvas, saveProjectCanvas } from '../lib/api';
import type { StateConnection } from '../lib/sharedStore';

// Per-project debounce for saving canvas (avoids cross-project collisions)
const saveTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

const debouncedSave = (projectId: string, components: CanvasComponent[]) => {
  // Clear existing timeout for this specific project
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

interface ErrorContext {
  message: string;
  stack?: string;
}

interface CanvasStore {
  // Current project ID (for persistence)
  currentProjectId: string | null;
  setCurrentProjectId: (id: string | null) => void;

  // Component library
  availableComponents: Component[];
  setAvailableComponents: (components: Component[]) => void;
  addAvailableComponent: (component: Component) => void;
  removeAvailableComponent: (componentName: string) => void;

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

  // UI state
  isGenerating: boolean;
  setIsGenerating: (value: boolean) => void;
  selectedComponentId: string | null;
  setSelectedComponentId: (id: string | null) => void;

  // Streaming state
  streamingEvents: StreamEvent[];
  streamStatus: StreamStatus;
  isStreamPanelExpanded: boolean;
  currentComponentName: string;
  generationMode: 'create' | 'edit' | 'fix';
  editingComponentName: string | null;  // Which component is being edited
  pendingFixError: ErrorContext | null;  // Error to auto-fix
  componentVersions: Record<string, number>;  // Track versions for iframe refresh
  addStreamingEvent: (event: StreamEvent) => void;
  clearStreamingEvents: () => void;
  setStreamStatus: (status: StreamStatus) => void;
  setStreamPanelExpanded: (expanded: boolean) => void;
  setCurrentComponentName: (name: string) => void;
  setGenerationMode: (mode: 'create' | 'edit' | 'fix') => void;
  setEditingComponentName: (name: string | null) => void;
  setPendingFixError: (error: ErrorContext | null) => void;
  incrementComponentVersion: (componentName: string) => void;
  startEditing: (componentName: string) => void;
  startFixing: (componentName: string, error?: ErrorContext) => void;

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
  // Current project ID (for persistence)
  currentProjectId: null,
  setCurrentProjectId: (id) => set({ currentProjectId: id }),

  // Component library
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
          // Update position if provided
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
      const removedComponent = state.canvasComponents.find((comp) => comp.id === id);
      const newComponents = state.canvasComponents.filter((comp) => comp.id !== id);

      // Clean up componentVersions if no other instances of this component on canvas
      let newVersions = state.componentVersions;
      if (removedComponent) {
        const componentStillExists = newComponents.some(
          (c) => c.componentName === removedComponent.componentName
        );
        if (!componentStillExists) {
          const { [removedComponent.componentName]: _, ...rest } = state.componentVersions;
          newVersions = rest;
        }
      }

      // Clean up state connections for this component
      const newConnections = state.stateConnections.filter((c) => c.componentId !== id);

      if (state.currentProjectId) {
        debouncedSave(state.currentProjectId, newComponents);
      }
      return {
        canvasComponents: newComponents,
        componentVersions: newVersions,
        stateConnections: newConnections,
      };
    }),
  clearCanvas: () => set({ canvasComponents: [] }),

  // UI state
  isGenerating: false,
  setIsGenerating: (value) => set({ isGenerating: value }),
  selectedComponentId: null,
  setSelectedComponentId: (id) => set({ selectedComponentId: id }),

  // Streaming state
  streamingEvents: [],
  streamStatus: 'idle',
  isStreamPanelExpanded: false,
  currentComponentName: '',
  generationMode: 'create',
  editingComponentName: null,
  pendingFixError: null,
  componentVersions: {},
  addStreamingEvent: (event) =>
    set((state) => ({
      streamingEvents: [...state.streamingEvents, event],
      // Auto-update status based on event type
      streamStatus:
        event.type === 'thinking' ? 'thinking' :
          event.type === 'tool_start' || event.type === 'tool_result' ? 'acting' :
            event.type === 'success' ? 'success' :
              event.type === 'error' ? 'error' :
                state.streamStatus,
    })),
  clearStreamingEvents: () => set({ streamingEvents: [], streamStatus: 'idle' }),
  setStreamStatus: (status) => set({ streamStatus: status }),
  setStreamPanelExpanded: (expanded) => set({ isStreamPanelExpanded: expanded }),
  setCurrentComponentName: (name) => set({ currentComponentName: name }),
  setGenerationMode: (mode) => set({ generationMode: mode }),
  setEditingComponentName: (name) => set({ editingComponentName: name }),
  setPendingFixError: (error) => set({ pendingFixError: error }),
  incrementComponentVersion: (componentName) =>
    set((state) => ({
      componentVersions: {
        ...state.componentVersions,
        [componentName]: (state.componentVersions[componentName] || 0) + 1,
      },
    })),
  startEditing: (componentName) => set({
    generationMode: 'edit',
    editingComponentName: componentName,
    currentComponentName: componentName,
    isStreamPanelExpanded: true,
    pendingFixError: null,
  }),
  startFixing: (componentName, error) => set({
    generationMode: 'fix',
    editingComponentName: componentName,
    currentComponentName: componentName,
    isStreamPanelExpanded: true,
    pendingFixError: error || null,
  }),

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
      // Remove existing connections for these component IDs, then add new ones
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
