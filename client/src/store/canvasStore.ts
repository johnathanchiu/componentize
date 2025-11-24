import { create } from 'zustand';
import type { Component, CanvasComponent, Interaction } from '../types/index';

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
