import { create } from 'zustand';
import type { Component, CanvasComponent, Interaction, StreamEvent, StreamStatus } from '../types/index';

interface ErrorContext {
  message: string;
  stack?: string;
}

interface CanvasStore {
  // Component library
  availableComponents: Component[];
  setAvailableComponents: (components: Component[]) => void;
  addAvailableComponent: (component: Component) => void;

  // Canvas items
  canvasComponents: CanvasComponent[];
  addToCanvas: (component: CanvasComponent) => void;
  updatePosition: (id: string, x: number, y: number) => void;
  updateSize: (id: string, width: number, height: number, x?: number, y?: number) => void;
  removeFromCanvas: (id: string) => void;
  clearCanvas: () => void;

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
  addStreamingEvent: (event: StreamEvent) => void;
  clearStreamingEvents: () => void;
  setStreamStatus: (status: StreamStatus) => void;
  setStreamPanelExpanded: (expanded: boolean) => void;
  setCurrentComponentName: (name: string) => void;
  setGenerationMode: (mode: 'create' | 'edit' | 'fix') => void;
  setEditingComponentName: (name: string | null) => void;
  setPendingFixError: (error: ErrorContext | null) => void;
  startEditing: (componentName: string) => void;
  startFixing: (componentName: string, error?: ErrorContext) => void;

  // Interactions
  addInteraction: (componentId: string, interaction: Interaction) => void;
  removeInteraction: (componentId: string, interactionId: string) => void;
  updateInteraction: (componentId: string, interactionId: string, updates: Partial<Interaction>) => void;
}

export const useCanvasStore = create<CanvasStore>((set) => ({
  // Component library
  availableComponents: [],
  setAvailableComponents: (components) => set({ availableComponents: components }),
  addAvailableComponent: (component) =>
    set((state) => ({
      availableComponents: [...state.availableComponents, component],
    })),

  // Canvas items
  canvasComponents: [],
  addToCanvas: (component) =>
    set((state) => ({
      canvasComponents: [...state.canvasComponents, component],
    })),
  updatePosition: (id, x, y) =>
    set((state) => ({
      canvasComponents: state.canvasComponents.map((comp) =>
        comp.id === id ? { ...comp, position: { x, y } } : comp
      ),
    })),
  updateSize: (id, width, height, x, y) =>
    set((state) => ({
      canvasComponents: state.canvasComponents.map((comp) => {
        if (comp.id === id) {
          const updates: Partial<CanvasComponent> = { size: { width, height } };
          // Update position if provided
          if (x !== undefined && y !== undefined) {
            updates.position = { x, y };
          }
          return { ...comp, ...updates };
        }
        return comp;
      }),
    })),
  removeFromCanvas: (id) =>
    set((state) => ({
      canvasComponents: state.canvasComponents.filter((comp) => comp.id !== id),
    })),
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
}));
