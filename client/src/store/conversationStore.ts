import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AgentTodo } from '../types/index';

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

// Tool call state for block accumulation
export interface ToolCallState {
  id: string;
  name: string;
  args: unknown;
  status: 'pending' | 'success' | 'error';
  result?: unknown;
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

// Assistant block - accumulated from delta events
export interface AssistantBlock {
  thinking: string;           // Accumulated thinking_delta text
  text: string;               // Accumulated text_delta text
  toolCalls: ToolCallState[]; // Tool calls in this turn
}

interface ConversationStore {
  // Project context
  currentProjectId: string | null;
  setCurrentProjectId: (projectId: string | null) => void;

  // Conversation messages
  conversationMessages: ConversationMessage[];
  addUserMessage: (content: string) => void;
  startAssistantMessage: () => void;
  updateCurrentAssistantThinking: (thinking: string) => void;
  updateCurrentAssistantToolCalls: (toolCalls: ToolCallState[]) => void;
  completeAssistantMessage: (content?: string) => void;
  clearConversation: () => void;
  loadConversationFromHistory: (history: ServerConversationMessage[]) => void;

  // Block accumulation state (for delta-based streaming)
  currentBlock: AssistantBlock | null;
  startNewBlock: () => void;
  appendThinkingDelta: (delta: string) => void;
  appendTextDelta: (delta: string) => void;
  addToolCall: (id: string, name: string, args: unknown) => void;
  setToolResult: (toolCallId: string, status: 'success' | 'error', result: unknown) => void;
  completeBlock: () => void;

  // Agent-managed todos (persist until agent clears)
  agentTodos: AgentTodo[];
  setAgentTodos: (todos: AgentTodo[]) => void;
}

export const useConversationStore = create<ConversationStore>()(
  persist(
    (set, get) => ({
      // Project context
      currentProjectId: null,
      setCurrentProjectId: (projectId) => set((state) => {
        if (state.currentProjectId === projectId) {
          return { currentProjectId: projectId };
        }
        // Clear conversation state when switching projects
        return {
          currentProjectId: projectId,
          conversationMessages: [],
          currentBlock: null,
          agentTodos: [],
        };
      }),

      // Conversation messages
      conversationMessages: [],

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

      // Block accumulation state
      currentBlock: null,

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
        // Deduplicate by tool use ID
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

      // Agent-managed todos - persist until agent clears them
      agentTodos: [],
      setAgentTodos: (todos) => set({ agentTodos: todos }),
    }),
    {
      name: 'componentize-conversation',
      partialize: (state) => ({
        currentProjectId: state.currentProjectId,
        conversationMessages: state.conversationMessages,
        agentTodos: state.agentTodos,
      }),
    }
  )
);
