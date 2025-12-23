import { BaseAgent } from '../base';
import type { StreamEvent, AgentTodo } from '../../../../shared/types';
import { ToolRegistry, EditComponentTool, ReadComponentTool, ManageTodosTool } from '../tools';
import { SYSTEM_PROMPT } from './prompt';
import { buildCanvasContext } from './handlers';
import { projectService } from '../../services/projectService';

interface ConversationContext {
  lastTodos: AgentTodo[];
  previousUserMessages: string[];
}

/**
 * Create the tool registry for the design agent
 */
function createDesignToolRegistry(): ToolRegistry {
  return new ToolRegistry([
    new EditComponentTool(),
    new ReadComponentTool(),
    new ManageTodosTool(),
  ]);
}

export class DesignAgent extends BaseAgent {
  constructor() {
    super(createDesignToolRegistry(), SYSTEM_PROMPT);
  }

  /**
   * Extract conversation context from history
   */
  private async getConversationContext(): Promise<ConversationContext> {
    if (!this.projectId) {
      return { lastTodos: [], previousUserMessages: [] };
    }

    const history = await projectService.getHistory(this.projectId);

    const previousUserMessages = history
      .filter(msg => msg.role === 'user')
      .map(msg => msg.content);

    let lastTodos: AgentTodo[] = [];

    for (let i = history.length - 1; i >= 0; i--) {
      const msg = history[i];
      if (msg.role === 'assistant' && msg.toolCalls) {
        for (const tc of msg.toolCalls) {
          if (tc.name === 'manage_todos' && tc.result && !lastTodos.length) {
            const result = tc.result as { todos?: AgentTodo[] };
            if (result.todos) {
              lastTodos = result.todos;
            }
          }
        }
      }
      if (lastTodos.length) break;
    }

    return { lastTodos, previousUserMessages };
  }

  /**
   * Build context string from previous conversation
   */
  private buildConversationContextString(context: ConversationContext): string {
    const parts: string[] = [];

    if (context.lastTodos.length > 0) {
      const incomplete = context.lastTodos.filter(t => t.status !== 'completed');
      if (incomplete.length > 0) {
        const taskSummary = context.lastTodos.map(t => {
          const status = t.status === 'completed' ? '✓' : t.status === 'in_progress' ? '→' : '○';
          return `${status} ${t.content}`;
        }).join('\n  ');
        parts.push(`PREVIOUS TASKS (continue from here):\n  ${taskSummary}`);
      }
    }

    return parts.join('\n\n');
  }

  /**
   * Generate components based on user prompt
   * Runs until Claude finishes naturally via end_turn
   */
  async *generate(prompt: string): AsyncGenerator<StreamEvent> {
    if (!this.projectId) {
      yield { type: 'error', message: 'No project context set', timestamp: Date.now() };
      return;
    }

    const canvasContext = await buildCanvasContext(this.projectId);
    const conversationContext = await this.getConversationContext();
    const conversationContextString = this.buildConversationContextString(conversationContext);

    let userContent = canvasContext;

    if (conversationContextString) {
      userContent += `\n\n${conversationContextString}`;
    }

    userContent += `\n\nUSER REQUEST: ${prompt}

Start now. Use edit_component to create or update components. For complex requests with multiple components, use manage_todos to track your progress.`;

    const messages = [
      {
        role: 'user' as const,
        content: userContent
      }
    ];

    // Run agent loop until Claude finishes (no early exit callback)
    yield* this.runAgentLoop(messages);
  }
}

// Export singleton instance
export const designAgent = new DesignAgent();
