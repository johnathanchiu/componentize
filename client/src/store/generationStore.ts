import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { StreamEvent, StreamStatus } from '../types/index';

interface ErrorContext {
  message: string;
  stack?: string;
}

interface GenerationStore {
  // Project context for session scoping
  currentProjectId: string | null;
  setCurrentProjectId: (projectId: string | null) => void;

  // UI state
  isGenerating: boolean;
  setIsGenerating: (value: boolean) => void;

  // Streaming state
  streamingEvents: StreamEvent[];
  streamStatus: StreamStatus;
  isStreamPanelExpanded: boolean;
  currentComponentName: string;
  generationMode: 'create' | 'edit' | 'fix';
  editingComponentName: string | null;
  pendingFixError: ErrorContext | null;
  componentVersions: Record<string, number>;

  // Actions
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
}

export const useGenerationStore = create<GenerationStore>()(
  persist(
    (set) => ({
      // Project context
      currentProjectId: null,
      setCurrentProjectId: (projectId) => set({ currentProjectId: projectId }),

      // UI state
      isGenerating: false,
      setIsGenerating: (value) => set({ isGenerating: value }),

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
    }),
    {
      name: 'componentize-generation',
      partialize: (state) => ({
        // Only persist conversation-related state, not transient UI state
        currentProjectId: state.currentProjectId,
        streamingEvents: state.streamingEvents,
        generationMode: state.generationMode,
        editingComponentName: state.editingComponentName,
        currentComponentName: state.currentComponentName,
        componentVersions: state.componentVersions,
        isStreamPanelExpanded: state.isStreamPanelExpanded,
      }),
    }
  )
);
