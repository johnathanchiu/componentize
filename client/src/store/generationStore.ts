import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { StreamEvent, StreamStatus, ComponentPlan, CanvasComponent, AgentTodo } from '../types/index';

// Server-side conversation message format (from history.json)
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
  thinking: string;           // Accumulated thinking_delta text (Claude's internal reasoning)
  text: string;               // Accumulated text_delta text (Claude's response to user)
  toolCalls: ToolCallState[]; // Tool calls in this turn
}

// Conversation message - groups events by turn for chat display
export interface ConversationMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;              // User prompt or assistant final text
  thinking?: string;            // Accumulated thinking (for assistant)
  toolCalls?: ToolCallState[];  // Tool calls in this turn
  isStreaming?: boolean;        // Currently streaming
  timestamp: number;
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

  // Block accumulation state (for delta-based streaming)
  currentBlock: AssistantBlock | null;
  startNewBlock: () => void;
  appendThinkingDelta: (delta: string) => void;
  appendTextDelta: (delta: string) => void;  // For extended thinking text responses
  addToolCall: (id: string, name: string, args: unknown) => void;
  setToolResult: (toolCallId: string, status: 'success' | 'error', result: unknown) => void;
  completeBlock: () => void;

  // Conversation messages - grouped by turn for chat display
  conversationMessages: ConversationMessage[];
  addUserMessage: (content: string) => void;
  startAssistantMessage: () => void;
  updateCurrentAssistantThinking: (thinking: string) => void;
  updateCurrentAssistantToolCalls: (toolCalls: ToolCallState[]) => void;
  completeAssistantMessage: (content?: string) => void;
  clearConversation: () => void;
  // Load conversation from server history
  loadConversationFromHistory: (history: ServerConversationMessage[]) => void;

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
  setStreamingEvents: (events: StreamEvent[]) => void;
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
          // Reset block accumulation state
          currentBlock: null,
          // Reset conversation messages
          conversationMessages: [],
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

      // Block accumulation state (for delta-based streaming)
      currentBlock: null,

      // Conversation messages - grouped by turn
      conversationMessages: [],

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
            // New delta-based events
            event.type === 'turn_start' ? 'thinking' :
            event.type === 'thinking_delta' ? 'thinking' :
            event.type === 'tool_call' ? 'acting' :
            event.type === 'complete' ? (event.data?.status === 'error' ? 'error' : 'success') :
            // Legacy events (kept for backward compatibility)
            event.type === 'thinking' ? 'thinking' :
            event.type === 'tool_start' || event.type === 'tool_result' ? 'acting' :
            event.type === 'success' ? 'success' :
            event.type === 'error' ? 'error' :
            state.streamStatus,
        })),

      setStreamingEvents: (events) => set({ streamingEvents: events }),
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

      // Block accumulation actions (for delta-based streaming)
      startNewBlock: () => set({
        currentBlock: { thinking: '', text: '', toolCalls: [] },
        streamStatus: 'thinking',
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

      addToolCall: (id, name, args) => set((state) => ({
        currentBlock: state.currentBlock
          ? {
              ...state.currentBlock,
              toolCalls: [...state.currentBlock.toolCalls, { id, name, args, status: 'pending' as const }]
            }
          : { thinking: '', text: '', toolCalls: [{ id, name, args, status: 'pending' as const }] },
        streamStatus: 'acting',
      })),

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

      // Conversation message actions
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
            // With extended thinking, thinking is always preserved
            isStreaming: false,
          };
        }
        return { conversationMessages: messages };
      }),

      clearConversation: () => set({ conversationMessages: [] }),

      // Load conversation from server history format
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
            // Convert server toolCalls to client ToolCallState format
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
          // Skip 'tool' messages - they're absorbed into assistant messages
        }

        set({ conversationMessages: messages });
      },

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
        conversationMessages: state.conversationMessages,
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
