import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import type { StreamStatus, AgentTodo } from '../../types/index';

interface ErrorContext {
  message: string;
  stack?: string;
}

// Tool call state for block accumulation
export interface ToolCallState {
  id: string;
  name: string;
  args: unknown;
  status: 'pending' | 'success' | 'error';
  result?: unknown;
}

// Assistant block - accumulated from delta events
export interface AssistantBlock {
  thinking: string;
  text: string;
  toolCalls: ToolCallState[];
}

// Conversation message for chat display
export interface ConversationMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  thinking?: string;
  toolCalls?: ToolCallState[];
  isStreaming?: boolean;
  timestamp: number;
}

// Server-side conversation message format
export interface ServerConversationMessage {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: number;
  thinking?: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    args?: Record<string, unknown>;
    status?: 'pending' | 'success' | 'error';
    result?: unknown;
  }>;
  toolCallId?: string;
}

interface GenerationState {
  // Generation status
  isGenerating: boolean;
  streamStatus: StreamStatus;

  // Mode
  generationMode: 'create' | 'edit' | 'fix';
  editingComponentName: string | null;
  pendingFixError: ErrorContext | null;

  // UI
  isStreamPanelExpanded: boolean;
  currentComponentName: string;

  // Component versions (for cache busting)
  componentVersions: Record<string, number>;

  // Project context
  currentProjectId: string | null;

  // Conversation
  conversationMessages: ConversationMessage[];
  currentBlock: AssistantBlock | null;

  // Agent todos
  agentTodos: AgentTodo[];
}

interface GenerationActions {
  // Generation status
  setIsGenerating: (value: boolean) => void;
  setStreamStatus: (status: StreamStatus) => void;

  // Mode
  setGenerationMode: (mode: 'create' | 'edit' | 'fix') => void;
  setEditingComponentName: (name: string | null) => void;
  setPendingFixError: (error: ErrorContext | null) => void;
  startEditing: (componentName: string) => void;
  startFixing: (componentName: string, error?: ErrorContext) => void;
  resetGenerationUI: () => void;

  // UI
  setStreamPanelExpanded: (expanded: boolean) => void;
  setCurrentComponentName: (name: string) => void;

  // Component versions
  incrementComponentVersion: (componentName: string) => void;

  // Project context
  setCurrentProjectId: (id: string | null) => void;

  // Conversation
  addUserMessage: (content: string) => void;
  startAssistantMessage: () => void;
  updateCurrentAssistantThinking: (thinking: string) => void;
  updateCurrentAssistantToolCalls: (toolCalls: ToolCallState[]) => void;
  completeAssistantMessage: (content?: string) => void;
  clearConversation: () => void;
  loadConversationFromHistory: (history: ServerConversationMessage[]) => void;

  // Block accumulation
  startNewBlock: () => void;
  appendThinkingDelta: (delta: string) => void;
  appendTextDelta: (delta: string) => void;
  addToolCall: (id: string, name: string, args: unknown) => void;
  setToolResult: (toolCallId: string, status: 'success' | 'error', result: unknown) => void;
  completeBlock: () => void;

  // Agent todos
  setAgentTodos: (todos: AgentTodo[]) => void;
}

export type GenerationStore = GenerationState & GenerationActions;

export const useGenerationStore = create<GenerationStore>()(
  persist(
    (set) => ({
      // State
      isGenerating: false,
      streamStatus: 'idle',
      generationMode: 'create',
      editingComponentName: null,
      pendingFixError: null,
      isStreamPanelExpanded: false,
      currentComponentName: '',
      componentVersions: {},
      currentProjectId: null,
      conversationMessages: [],
      currentBlock: null,
      agentTodos: [],

      // Generation status
      setIsGenerating: (value) => set({ isGenerating: value }),
      setStreamStatus: (status) => set({ streamStatus: status }),

      // Mode
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

      resetGenerationUI: () => set({
        isGenerating: false,
        streamStatus: 'idle',
        generationMode: 'create',
        editingComponentName: null,
        pendingFixError: null,
      }),

      // UI
      setStreamPanelExpanded: (expanded) => set({ isStreamPanelExpanded: expanded }),
      setCurrentComponentName: (name) => set({ currentComponentName: name }),

      // Component versions
      incrementComponentVersion: (componentName) =>
        set((state) => ({
          componentVersions: {
            ...state.componentVersions,
            [componentName]: (state.componentVersions[componentName] || 0) + 1,
          },
        })),

      // Project context
      setCurrentProjectId: (projectId) => set((state) => {
        if (state.currentProjectId === projectId) {
          return { currentProjectId: projectId };
        }
        return {
          currentProjectId: projectId,
          conversationMessages: [],
          currentBlock: null,
          agentTodos: [],
        };
      }),

      // Conversation
      addUserMessage: (content) => set((state) => ({
        conversationMessages: [
          ...state.conversationMessages,
          {
            id: `user-${Date.now()}`,
            type: 'user' as const,
            content,
            timestamp: Date.now(),
          }
        ]
      })),

      startAssistantMessage: () => set((state) => ({
        conversationMessages: [
          ...state.conversationMessages,
          {
            id: `assistant-${Date.now()}`,
            type: 'assistant' as const,
            content: '',
            thinking: '',
            toolCalls: [],
            isStreaming: true,
            timestamp: Date.now(),
          }
        ]
      })),

      updateCurrentAssistantThinking: (thinking) => set((state) => {
        const messages = [...state.conversationMessages];
        const lastMessage = messages[messages.length - 1];
        if (lastMessage && lastMessage.type === 'assistant') {
          messages[messages.length - 1] = { ...lastMessage, thinking };
        }
        return { conversationMessages: messages };
      }),

      updateCurrentAssistantToolCalls: (toolCalls) => set((state) => {
        const messages = [...state.conversationMessages];
        const lastMessage = messages[messages.length - 1];
        if (lastMessage && lastMessage.type === 'assistant') {
          messages[messages.length - 1] = { ...lastMessage, toolCalls };
        }
        return { conversationMessages: messages };
      }),

      completeAssistantMessage: (content) => set((state) => {
        const messages = [...state.conversationMessages];
        const lastMessage = messages[messages.length - 1];
        if (lastMessage && lastMessage.type === 'assistant') {
          messages[messages.length - 1] = {
            ...lastMessage,
            content: content || lastMessage.content,
            isStreaming: false,
          };
        }
        return { conversationMessages: messages };
      }),

      clearConversation: () => set({ conversationMessages: [] }),

      loadConversationFromHistory: (history) => {
        const messages: ConversationMessage[] = [];

        for (const msg of history) {
          if (msg.role === 'user') {
            messages.push({
              id: `user-${msg.timestamp}`,
              type: 'user',
              content: msg.content,
              timestamp: msg.timestamp,
            });
          } else if (msg.role === 'assistant') {
            const toolCalls: ToolCallState[] = (msg.toolCalls || []).map(tc => ({
              id: tc.id,
              name: tc.name,
              args: tc.args || {},
              status: tc.status || 'success',
              result: tc.result,
            }));

            messages.push({
              id: `assistant-${msg.timestamp}`,
              type: 'assistant',
              content: msg.content || '',
              thinking: msg.thinking,
              toolCalls,
              isStreaming: false,
              timestamp: msg.timestamp,
            });
          }
        }

        set({ conversationMessages: messages });
      },

      // Block accumulation
      startNewBlock: () => set({
        currentBlock: { thinking: '', text: '', toolCalls: [] },
      }),

      appendThinkingDelta: (delta) => set((state) => ({
        currentBlock: state.currentBlock
          ? { ...state.currentBlock, thinking: state.currentBlock.thinking + delta }
          : { thinking: delta, text: '', toolCalls: [] }
      })),

      appendTextDelta: (delta) => set((state) => ({
        currentBlock: state.currentBlock
          ? { ...state.currentBlock, text: state.currentBlock.text + delta }
          : { thinking: '', text: delta, toolCalls: [] }
      })),

      addToolCall: (id, name, args) => set((state) => {
        const existingIds = new Set(state.currentBlock?.toolCalls.map(tc => tc.id) || []);
        if (existingIds.has(id)) {
          return state;
        }

        return {
          currentBlock: state.currentBlock
            ? {
                ...state.currentBlock,
                toolCalls: [...state.currentBlock.toolCalls, { id, name, args, status: 'pending' as const }]
              }
            : { thinking: '', text: '', toolCalls: [{ id, name, args, status: 'pending' as const }] },
        };
      }),

      setToolResult: (toolCallId, status, result) => set((state) => ({
        currentBlock: state.currentBlock
          ? {
              ...state.currentBlock,
              toolCalls: state.currentBlock.toolCalls.map(tc =>
                tc.id === toolCallId ? { ...tc, status, result } : tc
              )
            }
          : null
      })),

      completeBlock: () => set({ currentBlock: null }),

      // Agent todos
      setAgentTodos: (todos) => set({ agentTodos: todos }),
    }),
    {
      name: 'componentize-generation',
      partialize: (state) => ({
        currentProjectId: state.currentProjectId,
        // NOTE: conversationMessages NOT persisted - server (disk) is source of truth
        agentTodos: state.agentTodos,
        componentVersions: state.componentVersions,
        generationMode: state.generationMode,
        editingComponentName: state.editingComponentName,
        currentComponentName: state.currentComponentName,
        isStreamPanelExpanded: state.isStreamPanelExpanded,
      }),
    }
  )
);

// ============================================================================
// Selector Hooks - Use these instead of destructuring the store directly
// ============================================================================

// State selectors (one per value - only re-renders when that value changes)
export const useIsGenerating = () => useGenerationStore((s) => s.isGenerating);
export const useStreamStatus = () => useGenerationStore((s) => s.streamStatus);
export const useGenerationMode = () => useGenerationStore((s) => s.generationMode);
export const useEditingComponentName = () => useGenerationStore((s) => s.editingComponentName);
export const usePendingFixError = () => useGenerationStore((s) => s.pendingFixError);
export const useAgentTodos = () => useGenerationStore((s) => s.agentTodos);
export const useStreamPanelExpanded = () => useGenerationStore((s) => s.isStreamPanelExpanded);
export const useCurrentComponentName = () => useGenerationStore((s) => s.currentComponentName);
export const useConversationMessages = () => useGenerationStore((s) => s.conversationMessages);
export const useCurrentBlock = () => useGenerationStore((s) => s.currentBlock);
export const useComponentVersions = () => useGenerationStore((s) => s.componentVersions);
export const useCurrentProjectId = () => useGenerationStore((s) => s.currentProjectId);

// Parameterized selector for component version
export const useComponentVersion = (name: string) => useGenerationStore((s) => s.componentVersions[name] || 0);

// Actions (grouped - use useShallow to prevent infinite loops from object creation)
export const useGenerationActions = () => useGenerationStore(
  useShallow((s) => ({
    setIsGenerating: s.setIsGenerating,
    setStreamStatus: s.setStreamStatus,
    setGenerationMode: s.setGenerationMode,
    setEditingComponentName: s.setEditingComponentName,
    setPendingFixError: s.setPendingFixError,
    setStreamPanelExpanded: s.setStreamPanelExpanded,
    setCurrentComponentName: s.setCurrentComponentName,
    startEditing: s.startEditing,
    startFixing: s.startFixing,
    resetGenerationUI: s.resetGenerationUI,
    incrementComponentVersion: s.incrementComponentVersion,
    setCurrentProjectId: s.setCurrentProjectId,
    addUserMessage: s.addUserMessage,
    startAssistantMessage: s.startAssistantMessage,
    updateCurrentAssistantThinking: s.updateCurrentAssistantThinking,
    updateCurrentAssistantToolCalls: s.updateCurrentAssistantToolCalls,
    completeAssistantMessage: s.completeAssistantMessage,
    clearConversation: s.clearConversation,
    loadConversationFromHistory: s.loadConversationFromHistory,
    startNewBlock: s.startNewBlock,
    appendThinkingDelta: s.appendThinkingDelta,
    appendTextDelta: s.appendTextDelta,
    addToolCall: s.addToolCall,
    setToolResult: s.setToolResult,
    completeBlock: s.completeBlock,
    setAgentTodos: s.setAgentTodos,
  }))
);
