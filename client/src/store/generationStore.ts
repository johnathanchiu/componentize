import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { StreamEvent, StreamStatus, ComponentPlan, CanvasComponent, AgentTodo } from '../types/index';

interface ErrorContext {
  message: string;
  stack?: string;
}

// Page generation status (merged from pageGenerationStore)
export type PageGenerationStatus = 'idle' | 'modal' | 'planning' | 'generating' | 'complete' | 'error';

interface GenerationStore {
  // Project context for session scoping
  currentProjectId: string | null;
  setCurrentProjectId: (projectId: string | null) => void;

  // UI state
  isGenerating: boolean;
  setIsGenerating: (value: boolean) => void;

  // Single component streaming state
  streamingEvents: StreamEvent[];
  streamStatus: StreamStatus;
  isStreamPanelExpanded: boolean;
  currentComponentName: string;
  generationMode: 'create' | 'edit' | 'fix';
  editingComponentName: string | null;
  pendingFixError: ErrorContext | null;
  componentVersions: Record<string, number>;

  // Agent-managed todos
  agentTodos: AgentTodo[];
  setAgentTodos: (todos: AgentTodo[]) => void;

  // Page generation state (merged from pageGenerationStore)
  pageStatus: PageGenerationStatus;
  pagePlan: ComponentPlan[] | null;
  pageCurrentComponentIndex: number;
  pageTotalComponents: number;
  pageCompletedComponents: string[];
  pageFailedComponents: Array<{ name: string; error: string }>;
  pageCanvasComponents: CanvasComponent[];
  pageEvents: StreamEvent[];
  pageCurrentThinking: string;

  // Single component actions
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

  // Page generation actions (merged from pageGenerationStore)
  pageOpenModal: () => void;
  pageCloseModal: () => void;
  pageStartGeneration: () => void;
  pageSetPlan: (plan: ComponentPlan[], total: number) => void;
  pageSetCurrentComponent: (index: number, name: string) => void;
  pageAddThinking: (text: string) => void;
  pageMarkComponentComplete: (name: string, canvasComponent?: CanvasComponent) => void;
  pageMarkComponentFailed: (name: string, error: string) => void;
  pageAddEvent: (event: StreamEvent) => void;
  pageComplete: () => void;
  pageSetError: (message: string) => void;
  pageReset: () => void;
}

export const useGenerationStore = create<GenerationStore>()(
  persist(
    (set) => ({
      // Project context
      currentProjectId: null,
      setCurrentProjectId: (projectId) => set((state) => {
        // Only reset if project actually changed
        if (state.currentProjectId === projectId) {
          return { currentProjectId: projectId };
        }
        // Clear generation state when switching projects
        return {
          currentProjectId: projectId,
          // Reset single component streaming state
          streamingEvents: [],
          streamStatus: 'idle',
          currentComponentName: '',
          generationMode: 'create',
          editingComponentName: null,
          pendingFixError: null,
          isGenerating: false,
          // Reset agent todos
          agentTodos: [],
          // Reset page generation state
          pageStatus: 'idle',
          pagePlan: null,
          pageCurrentComponentIndex: 0,
          pageTotalComponents: 0,
          pageCompletedComponents: [],
          pageFailedComponents: [],
          pageCanvasComponents: [],
          pageEvents: [],
          pageCurrentThinking: '',
        };
      }),

      // UI state
      isGenerating: false,
      setIsGenerating: (value) => set({ isGenerating: value }),

      // Single component streaming state
      streamingEvents: [],
      streamStatus: 'idle',
      isStreamPanelExpanded: false,
      currentComponentName: '',
      generationMode: 'create',
      editingComponentName: null,
      pendingFixError: null,
      componentVersions: {},

      // Agent-managed todos
      agentTodos: [],

      // Page generation state
      pageStatus: 'idle',
      pagePlan: null,
      pageCurrentComponentIndex: 0,
      pageTotalComponents: 0,
      pageCompletedComponents: [],
      pageFailedComponents: [],
      pageCanvasComponents: [],
      pageEvents: [],
      pageCurrentThinking: '',

      // Single component actions
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

      // Agent-managed todos
      setAgentTodos: (todos) => set({ agentTodos: todos }),

      // Page generation actions
      pageOpenModal: () => set({ pageStatus: 'modal' }),

      pageCloseModal: () => set({ pageStatus: 'idle' }),

      pageStartGeneration: () => set({
        pageStatus: 'planning',
        pagePlan: null,
        pageCurrentComponentIndex: 0,
        pageTotalComponents: 0,
        pageCompletedComponents: [],
        pageFailedComponents: [],
        pageCanvasComponents: [],
        pageEvents: [],
        pageCurrentThinking: '',
      }),

      pageSetPlan: (plan, total) => set({
        pageStatus: 'generating',
        pagePlan: plan,
        pageTotalComponents: total,
      }),

      pageSetCurrentComponent: (index, name) => set({
        pageCurrentComponentIndex: index,
        pageCurrentThinking: `Creating ${name}...`,
      }),

      pageAddThinking: (text) => set({ pageCurrentThinking: text }),

      pageMarkComponentComplete: (name, canvasComponent) => set((state) => ({
        pageCompletedComponents: [...state.pageCompletedComponents, name],
        pageCanvasComponents: canvasComponent
          ? [...state.pageCanvasComponents, canvasComponent]
          : state.pageCanvasComponents,
      })),

      pageMarkComponentFailed: (name, error) => set((state) => ({
        pageFailedComponents: [...state.pageFailedComponents, { name, error }],
      })),

      pageAddEvent: (event) => set((state) => ({
        pageEvents: [...state.pageEvents, event],
      })),

      pageComplete: () => set({ pageStatus: 'complete' }),

      pageSetError: (message) => set({
        pageStatus: 'error',
        pageCurrentThinking: message,
      }),

      pageReset: () => set({
        pageStatus: 'idle',
        pagePlan: null,
        pageCurrentComponentIndex: 0,
        pageTotalComponents: 0,
        pageCompletedComponents: [],
        pageFailedComponents: [],
        pageCanvasComponents: [],
        pageEvents: [],
        pageCurrentThinking: '',
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
        agentTodos: state.agentTodos,
      }),
    }
  )
);
