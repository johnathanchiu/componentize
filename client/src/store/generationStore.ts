import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import type { AgentTodo } from '@/shared/types';
import type { StreamStatus } from '@/types/index';

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

// Message block - ordered unit of content
export type MessageBlock =
  | { type: 'thinking'; content: string }
  | { type: 'text'; content: string }
  | { type: 'tool_call'; toolCall: ToolCallState };

// Conversation message for chat display
export interface ConversationMessage {
  id: string;
  type: 'user' | 'assistant';
  blocks: MessageBlock[];  // Ordered array preserves streaming order
  isStreaming?: boolean;
  timestamp: number;
  content?: string;  // For user messages only
}

// Current block being accumulated during streaming
interface StreamingBlock {
  blocks: MessageBlock[];
  currentBlockType: 'thinking' | 'text' | null;
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
  currentBlock: StreamingBlock | null;

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
  completeAssistantMessage: () => void;
  clearConversation: () => void;
  loadConversationFromHistory: (history: ServerConversationMessage[]) => void;

  // Block accumulation - streams content into currentBlock, then merges on complete
  appendThinkingDelta: (delta: string) => void;
  appendTextDelta: (delta: string) => void;
  addToolCall: (id: string, name: string, args: unknown) => void;
  setToolResult: (toolCallId: string, status: 'success' | 'error', result: unknown) => void;

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
            blocks: [],
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
            blocks: [],
            isStreaming: true,
            timestamp: Date.now(),
          }
        ]
      })),

      completeAssistantMessage: () => set((state) => {
        const messages = [...state.conversationMessages];
        const lastMessage = messages[messages.length - 1];
        if (lastMessage && lastMessage.type === 'assistant' && state.currentBlock) {
          // Merge accumulated blocks into the message
          messages[messages.length - 1] = {
            ...lastMessage,
            blocks: state.currentBlock.blocks,
            isStreaming: false,
          };
        } else if (lastMessage && lastMessage.type === 'assistant') {
          messages[messages.length - 1] = {
            ...lastMessage,
            isStreaming: false,
          };
        }
        return { conversationMessages: messages, currentBlock: null };
      }),

      clearConversation: () => set({ conversationMessages: [] }),

      loadConversationFromHistory: (history) => {
        const messages: ConversationMessage[] = [];

        for (const msg of history) {
          if (msg.role === 'user') {
            messages.push({
              id: `user-${msg.timestamp}`,
              type: 'user',
              blocks: [],
              content: msg.content,
              timestamp: msg.timestamp,
            });
          } else if (msg.role === 'assistant') {
            // Convert old format to blocks
            const blocks: MessageBlock[] = [];

            // Add thinking block if present
            if (msg.thinking) {
              blocks.push({ type: 'thinking', content: msg.thinking });
            }

            // Add tool call blocks
            if (msg.toolCalls) {
              for (const tc of msg.toolCalls) {
                blocks.push({
                  type: 'tool_call',
                  toolCall: {
                    id: tc.id,
                    name: tc.name,
                    args: tc.args || {},
                    status: tc.status || 'success',
                    result: tc.result,
                  }
                });
              }
            }

            // Add text block if present
            if (msg.content) {
              blocks.push({ type: 'text', content: msg.content });
            }

            messages.push({
              id: `assistant-${msg.timestamp}`,
              type: 'assistant',
              blocks,
              isStreaming: false,
              timestamp: msg.timestamp,
            });
          }
        }

        set({ conversationMessages: messages });
      },

      // Block accumulation - builds ordered blocks array during streaming
      appendThinkingDelta: (delta) => set((state) => {
        if (!state.currentBlock) {
          return { currentBlock: { blocks: [{ type: 'thinking', content: delta }], currentBlockType: 'thinking' } };
        }

        const blocks = [...state.currentBlock.blocks];

        // If we were doing text and now thinking, start new thinking block
        if (state.currentBlock.currentBlockType !== 'thinking') {
          blocks.push({ type: 'thinking', content: delta });
          return { currentBlock: { blocks, currentBlockType: 'thinking' } };
        }

        // Append to current thinking block
        const lastBlock = blocks[blocks.length - 1];
        if (lastBlock?.type === 'thinking') {
          blocks[blocks.length - 1] = { type: 'thinking', content: lastBlock.content + delta };
        } else {
          blocks.push({ type: 'thinking', content: delta });
        }
        return { currentBlock: { blocks, currentBlockType: 'thinking' } };
      }),

      appendTextDelta: (delta) => set((state) => {
        if (!state.currentBlock) {
          return { currentBlock: { blocks: [{ type: 'text', content: delta }], currentBlockType: 'text' } };
        }

        const blocks = [...state.currentBlock.blocks];

        // If we were doing thinking and now text, start new text block
        if (state.currentBlock.currentBlockType !== 'text') {
          blocks.push({ type: 'text', content: delta });
          return { currentBlock: { blocks, currentBlockType: 'text' } };
        }

        // Append to current text block
        const lastBlock = blocks[blocks.length - 1];
        if (lastBlock?.type === 'text') {
          blocks[blocks.length - 1] = { type: 'text', content: lastBlock.content + delta };
        } else {
          blocks.push({ type: 'text', content: delta });
        }
        return { currentBlock: { blocks, currentBlockType: 'text' } };
      }),

      addToolCall: (id, name, args) => set((state) => {
        if (!state.currentBlock) {
          return {
            currentBlock: {
              blocks: [{ type: 'tool_call', toolCall: { id, name, args, status: 'pending' as const } }],
              currentBlockType: null,
            }
          };
        }

        // Check for duplicate
        const existingIds = new Set(
          state.currentBlock.blocks
            .filter((b): b is { type: 'tool_call'; toolCall: ToolCallState } => b.type === 'tool_call')
            .map(b => b.toolCall.id)
        );
        if (existingIds.has(id)) {
          return state;
        }

        // Tool calls break the current text/thinking block
        const blocks = [...state.currentBlock.blocks];
        blocks.push({ type: 'tool_call', toolCall: { id, name, args, status: 'pending' as const } });
        return { currentBlock: { blocks, currentBlockType: null } };
      }),

      setToolResult: (toolCallId, status, result) => set((state) => {
        if (!state.currentBlock) return state;

        const blocks = state.currentBlock.blocks.map(block => {
          if (block.type === 'tool_call' && block.toolCall.id === toolCallId) {
            return { ...block, toolCall: { ...block.toolCall, status, result } };
          }
          return block;
        });
        return { currentBlock: { ...state.currentBlock, blocks } };
      }),

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
    completeAssistantMessage: s.completeAssistantMessage,
    clearConversation: s.clearConversation,
    loadConversationFromHistory: s.loadConversationFromHistory,
    appendThinkingDelta: s.appendThinkingDelta,
    appendTextDelta: s.appendTextDelta,
    addToolCall: s.addToolCall,
    setToolResult: s.setToolResult,
    setAgentTodos: s.setAgentTodos,
  }))
);
