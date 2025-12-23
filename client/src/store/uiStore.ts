import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { StreamStatus } from '../types/index';

interface ErrorContext {
  message: string;
  stack?: string;
}

interface UIStore {
  // Generation state
  isGenerating: boolean;
  setIsGenerating: (value: boolean) => void;

  // Stream status
  streamStatus: StreamStatus;
  setStreamStatus: (status: StreamStatus) => void;

  // Stream panel
  isStreamPanelExpanded: boolean;
  setStreamPanelExpanded: (expanded: boolean) => void;

  // Component context
  currentComponentName: string;
  setCurrentComponentName: (name: string) => void;

  // Generation mode
  generationMode: 'create' | 'edit' | 'fix';
  setGenerationMode: (mode: 'create' | 'edit' | 'fix') => void;

  // Editing context
  editingComponentName: string | null;
  setEditingComponentName: (name: string | null) => void;

  // Fix mode context
  pendingFixError: ErrorContext | null;
  setPendingFixError: (error: ErrorContext | null) => void;

  // Component versions (for cache busting)
  componentVersions: Record<string, number>;
  incrementComponentVersion: (componentName: string) => void;

  // Helpers
  startEditing: (componentName: string) => void;
  startFixing: (componentName: string, error?: ErrorContext) => void;
  resetGenerationUI: () => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      // Generation state
      isGenerating: false,
      setIsGenerating: (value) => set({ isGenerating: value }),

      // Stream status
      streamStatus: 'idle',
      setStreamStatus: (status) => set({ streamStatus: status }),

      // Stream panel
      isStreamPanelExpanded: false,
      setStreamPanelExpanded: (expanded) => set({ isStreamPanelExpanded: expanded }),

      // Component context
      currentComponentName: '',
      setCurrentComponentName: (name) => set({ currentComponentName: name }),

      // Generation mode
      generationMode: 'create',
      setGenerationMode: (mode) => set({ generationMode: mode }),

      // Editing context
      editingComponentName: null,
      setEditingComponentName: (name) => set({ editingComponentName: name }),

      // Fix mode context
      pendingFixError: null,
      setPendingFixError: (error) => set({ pendingFixError: error }),

      // Component versions
      componentVersions: {},
      incrementComponentVersion: (componentName) =>
        set((state) => ({
          componentVersions: {
            ...state.componentVersions,
            [componentName]: (state.componentVersions[componentName] || 0) + 1,
          },
        })),

      // Helpers
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

      resetGenerationUI: () => set({
        isGenerating: false,
        streamStatus: 'idle',
        generationMode: 'create',
        editingComponentName: null,
        pendingFixError: null,
      }),
    }),
    {
      name: 'componentize-ui',
      partialize: (state) => ({
        generationMode: state.generationMode,
        editingComponentName: state.editingComponentName,
        currentComponentName: state.currentComponentName,
        componentVersions: state.componentVersions,
        isStreamPanelExpanded: state.isStreamPanelExpanded,
      }),
    }
  )
);
