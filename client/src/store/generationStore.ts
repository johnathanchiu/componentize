import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { StreamEvent, ComponentPlan, CanvasComponent } from '../types/index';

// Re-export from new focused stores for backward compatibility
export {
  useConversationStore,
  type ServerConversationMessage,
  type ToolCallState,
  type ConversationMessage,
  type AssistantBlock,
} from './conversationStore';

export { useUIStore } from './uiStore';

// Page generation status
export type PageGenerationStatus = 'idle' | 'modal' | 'planning' | 'generating' | 'complete' | 'error';

interface PageGenerationStore {
  // Page generation state
  pageStatus: PageGenerationStatus;
  pagePlan: ComponentPlan[] | null;
  pageCurrentComponentIndex: number;
  pageTotalComponents: number;
  pageCompletedComponents: string[];
  pageFailedComponents: Array<{ name: string; error: string }>;
  pageCanvasComponents: CanvasComponent[];
  pageEvents: StreamEvent[];
  pageCurrentThinking: string;

  // Page generation actions
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

export const usePageGenerationStore = create<PageGenerationStore>()(
  persist(
    (set) => ({
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
      name: 'componentize-page-generation',
      partialize: () => ({}), // Don't persist page generation state
    }
  )
);

// Legacy compatibility layer - combines all stores
// This allows existing code to work without changes
import { useConversationStore } from './conversationStore';
import { useUIStore } from './uiStore';

export const useGenerationStore = Object.assign(
  // Main hook returns combined state
  () => {
    const conversation = useConversationStore();
    const ui = useUIStore();
    const page = usePageGenerationStore();

    return {
      // From conversation store
      currentProjectId: conversation.currentProjectId,
      setCurrentProjectId: (id: string | null) => {
        conversation.setCurrentProjectId(id);
      },
      conversationMessages: conversation.conversationMessages,
      addUserMessage: conversation.addUserMessage,
      startAssistantMessage: conversation.startAssistantMessage,
      updateCurrentAssistantThinking: conversation.updateCurrentAssistantThinking,
      updateCurrentAssistantToolCalls: conversation.updateCurrentAssistantToolCalls,
      completeAssistantMessage: conversation.completeAssistantMessage,
      clearConversation: conversation.clearConversation,
      loadConversationFromHistory: conversation.loadConversationFromHistory,
      currentBlock: conversation.currentBlock,
      startNewBlock: conversation.startNewBlock,
      appendThinkingDelta: conversation.appendThinkingDelta,
      appendTextDelta: conversation.appendTextDelta,
      addToolCall: conversation.addToolCall,
      setToolResult: conversation.setToolResult,
      completeBlock: conversation.completeBlock,
      agentTodos: conversation.agentTodos,
      setAgentTodos: conversation.setAgentTodos,

      // From UI store
      isGenerating: ui.isGenerating,
      setIsGenerating: ui.setIsGenerating,
      streamStatus: ui.streamStatus,
      setStreamStatus: ui.setStreamStatus,
      isStreamPanelExpanded: ui.isStreamPanelExpanded,
      setStreamPanelExpanded: ui.setStreamPanelExpanded,
      currentComponentName: ui.currentComponentName,
      setCurrentComponentName: ui.setCurrentComponentName,
      generationMode: ui.generationMode,
      setGenerationMode: ui.setGenerationMode,
      editingComponentName: ui.editingComponentName,
      setEditingComponentName: ui.setEditingComponentName,
      pendingFixError: ui.pendingFixError,
      setPendingFixError: ui.setPendingFixError,
      componentVersions: ui.componentVersions,
      incrementComponentVersion: ui.incrementComponentVersion,
      startEditing: ui.startEditing,
      startFixing: ui.startFixing,

      // From page generation store
      pageStatus: page.pageStatus,
      pagePlan: page.pagePlan,
      pageCurrentComponentIndex: page.pageCurrentComponentIndex,
      pageTotalComponents: page.pageTotalComponents,
      pageCompletedComponents: page.pageCompletedComponents,
      pageFailedComponents: page.pageFailedComponents,
      pageCanvasComponents: page.pageCanvasComponents,
      pageEvents: page.pageEvents,
      pageCurrentThinking: page.pageCurrentThinking,
      pageOpenModal: page.pageOpenModal,
      pageCloseModal: page.pageCloseModal,
      pageStartGeneration: page.pageStartGeneration,
      pageSetPlan: page.pageSetPlan,
      pageSetCurrentComponent: page.pageSetCurrentComponent,
      pageAddThinking: page.pageAddThinking,
      pageMarkComponentComplete: page.pageMarkComponentComplete,
      pageMarkComponentFailed: page.pageMarkComponentFailed,
      pageAddEvent: page.pageAddEvent,
      pageComplete: page.pageComplete,
      pageSetError: page.pageSetError,
      pageReset: page.pageReset,

      // Deprecated - no longer needed with new stores
      streamingEvents: [] as StreamEvent[],
      addStreamingEvent: () => {},
      setStreamingEvents: () => {},
      clearStreamingEvents: () => {},
    };
  },
  {
    // Static methods for direct access
    getState: () => {
      const conversation = useConversationStore.getState();
      const ui = useUIStore.getState();
      const page = usePageGenerationStore.getState();

      return {
        currentProjectId: conversation.currentProjectId,
        setCurrentProjectId: conversation.setCurrentProjectId,
        conversationMessages: conversation.conversationMessages,
        addUserMessage: conversation.addUserMessage,
        startAssistantMessage: conversation.startAssistantMessage,
        updateCurrentAssistantThinking: conversation.updateCurrentAssistantThinking,
        updateCurrentAssistantToolCalls: conversation.updateCurrentAssistantToolCalls,
        completeAssistantMessage: conversation.completeAssistantMessage,
        clearConversation: conversation.clearConversation,
        loadConversationFromHistory: conversation.loadConversationFromHistory,
        currentBlock: conversation.currentBlock,
        startNewBlock: conversation.startNewBlock,
        appendThinkingDelta: conversation.appendThinkingDelta,
        appendTextDelta: conversation.appendTextDelta,
        addToolCall: conversation.addToolCall,
        setToolResult: conversation.setToolResult,
        completeBlock: conversation.completeBlock,
        agentTodos: conversation.agentTodos,
        setAgentTodos: conversation.setAgentTodos,
        isGenerating: ui.isGenerating,
        setIsGenerating: ui.setIsGenerating,
        streamStatus: ui.streamStatus,
        setStreamStatus: ui.setStreamStatus,
        isStreamPanelExpanded: ui.isStreamPanelExpanded,
        setStreamPanelExpanded: ui.setStreamPanelExpanded,
        currentComponentName: ui.currentComponentName,
        setCurrentComponentName: ui.setCurrentComponentName,
        generationMode: ui.generationMode,
        setGenerationMode: ui.setGenerationMode,
        editingComponentName: ui.editingComponentName,
        setEditingComponentName: ui.setEditingComponentName,
        pendingFixError: ui.pendingFixError,
        setPendingFixError: ui.setPendingFixError,
        componentVersions: ui.componentVersions,
        incrementComponentVersion: ui.incrementComponentVersion,
        startEditing: ui.startEditing,
        startFixing: ui.startFixing,
        pageStatus: page.pageStatus,
        pagePlan: page.pagePlan,
        pageCurrentComponentIndex: page.pageCurrentComponentIndex,
        pageTotalComponents: page.pageTotalComponents,
        pageCompletedComponents: page.pageCompletedComponents,
        pageFailedComponents: page.pageFailedComponents,
        pageCanvasComponents: page.pageCanvasComponents,
        pageEvents: page.pageEvents,
        pageCurrentThinking: page.pageCurrentThinking,
        pageOpenModal: page.pageOpenModal,
        pageCloseModal: page.pageCloseModal,
        pageStartGeneration: page.pageStartGeneration,
        pageSetPlan: page.pageSetPlan,
        pageSetCurrentComponent: page.pageSetCurrentComponent,
        pageAddThinking: page.pageAddThinking,
        pageMarkComponentComplete: page.pageMarkComponentComplete,
        pageMarkComponentFailed: page.pageMarkComponentFailed,
        pageAddEvent: page.pageAddEvent,
        pageComplete: page.pageComplete,
        pageSetError: page.pageSetError,
        pageReset: page.pageReset,
        streamingEvents: [] as StreamEvent[],
        addStreamingEvent: () => {},
        setStreamingEvents: () => {},
        clearStreamingEvents: () => {},
      };
    },
  }
);
