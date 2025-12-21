import { BaseAgent, type ToolResult } from '../base';
import type { StreamEvent, AgentTodo } from '../../../../shared/types';
import { DESIGN_TOOLS } from './tools';
import { SYSTEM_PROMPT } from './prompt';
import {
  buildCanvasContext,
  handleReadComponent,
  handleEditComponent,
  handleManageTodos,
  type HandlerContext,
} from './handlers';
import { projectService } from '../../services/projectService';
import type {
  EditComponentInput,
  ManageTodosInput,
  ReadComponentInput,
} from './types';

interface ConversationContext {
  lastTodos: AgentTodo[];
  previousUserMessages: string[];
}

export class DesignAgent extends BaseAgent {
  private projectId: string | null = null;
  private createdComponents: string[] = [];
  private validationFailures: Map<string, number> = new Map();

  constructor() {
    super(DESIGN_TOOLS, SYSTEM_PROMPT);
  }

  /**
   * Set the project context for subsequent operations
   */
  setProjectContext(projectId: string): void {
    this.projectId = projectId;
    this.createdComponents = [];
    this.validationFailures.clear();
  }

  /**
   * Clear the project context
   */
  clearProjectContext(): void {
    this.projectId = null;
    this.createdComponents = [];
    this.validationFailures.clear();
  }

  /**
   * Get handler context for passing to tool handlers
   */
  private getHandlerContext(): HandlerContext {
    return {
      projectId: this.projectId!,
      createdComponents: this.createdComponents,
      validationFailures: this.validationFailures,
    };
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

  protected async executeTool(toolName: string, toolInput: unknown): Promise<ToolResult> {
    if (!this.projectId) {
      return { status: 'error', message: 'No project context set' };
    }

    const context = this.getHandlerContext();

    switch (toolName) {
      case 'read_component': {
        return handleReadComponent(toolInput as ReadComponentInput, this.projectId);
      }

      case 'edit_component': {
        return handleEditComponent(toolInput as EditComponentInput, context);
      }

      case 'manage_todos': {
        return handleManageTodos(toolInput as ManageTodosInput);
      }

      default:
        return {
          status: 'error',
          message: `Unknown tool: ${toolName}`
        };
    }
  }

  /**
   * Generate components based on user prompt
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

    yield* this.runAgentLoop(messages, (result) => {
      // Don't stop on read actions
      if (result.action === 'read') {
        return false;
      }

      // Don't stop on manage_todos - this is just for user visibility
      if (result.todos) {
        return false;
      }

      // Success when a component is created/updated
      if (result.status === 'success' && result.component_name) {
        return true;
      }

      return false;
    });
  }
}

// Export singleton instance
export const designAgent = new DesignAgent();
