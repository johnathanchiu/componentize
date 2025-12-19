import { BaseAgent, type ToolResult } from '../base';
import type { StreamEvent, AgentTodo } from '../../../../shared/types';
import { COMPONENT_TOOLS } from './tools';
import { SYSTEM_PROMPT } from './prompt';
import {
  buildCanvasContext,
  handlePlanComponents,
  handleCreateComponent,
  handleReadComponent,
  handleUpdateComponent,
  handleManageTodos,
  type HandlerContext,
  type ComponentPlan,
} from './handlers';
import { projectService } from '../../services/projectService';
import type {
  PlanComponentsInput,
  CreateComponentInput,
  ManageTodosInput,
  ReadComponentInput,
  UpdateComponentInput,
} from './types';

interface ConversationContext {
  lastTodos: AgentTodo[];
  previousUserMessages: string[];
  lastPlan: ComponentPlan[] | null;
}

export class ComponentAgent extends BaseAgent {
  private projectId: string | null = null;
  private pendingPlan: ComponentPlan[] = [];
  private createdComponents: string[] = [];
  private validationFailures: Map<string, number> = new Map();

  constructor() {
    super(COMPONENT_TOOLS, SYSTEM_PROMPT);
  }

  /**
   * Set the project context for subsequent operations
   */
  setProjectContext(projectId: string): void {
    this.projectId = projectId;
    this.pendingPlan = [];
    this.createdComponents = [];
    this.validationFailures.clear();
  }

  /**
   * Clear the project context
   */
  clearProjectContext(): void {
    this.projectId = null;
    this.pendingPlan = [];
    this.createdComponents = [];
    this.validationFailures.clear();
  }

  /**
   * Get handler context for passing to tool handlers
   */
  private getHandlerContext(): HandlerContext {
    return {
      projectId: this.projectId!,
      pendingPlan: this.pendingPlan,
      createdComponents: this.createdComponents,
      validationFailures: this.validationFailures,
    };
  }

  /**
   * Extract conversation context from history
   * This allows the agent to continue from where it left off
   */
  private async getConversationContext(): Promise<ConversationContext> {
    if (!this.projectId) {
      return { lastTodos: [], previousUserMessages: [], lastPlan: null };
    }

    const history = await projectService.getHistory(this.projectId);

    // Find the last todo_update event to get current task state
    let lastTodos: AgentTodo[] = [];
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].type === 'todo_update' && history[i].data?.todos) {
        lastTodos = history[i].data!.todos as AgentTodo[];
        break;
      }
    }

    // Extract previous user messages for context
    const previousUserMessages = history
      .filter(e => e.type === 'user_message')
      .map(e => e.message);

    // Find the last plan_components result
    let lastPlan: ComponentPlan[] | null = null;
    for (let i = history.length - 1; i >= 0; i--) {
      const event = history[i];
      if (event.type === 'tool_result' &&
        event.data?.toolName === 'plan_components' &&
        event.data?.result) {
        const result = event.data.result as { plan?: ComponentPlan[] };
        if (result.plan) {
          lastPlan = result.plan;
          break;
        }
      }
    }

    return { lastTodos, previousUserMessages, lastPlan };
  }

  /**
   * Build context string from previous conversation
   */
  private buildConversationContextString(context: ConversationContext): string {
    const parts: string[] = [];

    // Include last plan if there was one
    if (context.lastPlan && context.lastPlan.length > 0) {
      const completedComponents = context.lastTodos
        .filter(t => t.status === 'completed')
        .map(t => t.content.replace('Create ', '').replace(' component', ''));

      const pendingComponents = context.lastPlan
        .filter(p => !completedComponents.includes(p.name))
        .map(p => p.name);

      if (pendingComponents.length > 0) {
        parts.push(`PREVIOUS PLAN: You were creating ${context.lastPlan.length} components. Completed: ${completedComponents.join(', ') || '(none)'}. Still pending: ${pendingComponents.join(', ')}.`);
      }
    }

    // Include last task state if there are incomplete tasks
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
      case 'plan_components': {
        const { result, updatedPlan } = handlePlanComponents(
          toolInput as PlanComponentsInput,
          context
        );
        this.pendingPlan = updatedPlan;
        return result;
      }

      case 'create_component': {
        return handleCreateComponent(toolInput as CreateComponentInput, context);
      }

      case 'read_component': {
        return handleReadComponent(toolInput as ReadComponentInput, this.projectId);
      }

      case 'update_component': {
        return handleUpdateComponent(toolInput as UpdateComponentInput, context);
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

    // If we have a previous plan, restore it so the agent can track progress
    if (conversationContext.lastPlan) {
      this.pendingPlan = conversationContext.lastPlan;
      // Mark already-created components
      const completedNames = conversationContext.lastTodos
        .filter(t => t.status === 'completed')
        .map(t => t.content.replace('Create ', '').replace(' component', ''));
      this.createdComponents = completedNames;
    }

    // Build the user message with context
    let userContent = canvasContext;

    if (conversationContextString) {
      userContent += `\n\n${conversationContextString}`;
    }

    userContent += `\n\nUSER REQUEST: ${prompt}

Based on the complexity of this request:
- If simple (single button, card, form): Call create_component directly
- If complex (landing page, multiple elements): Call plan_components first, then create each
- If user asks to "continue" and there are PREVIOUS TASKS shown above: Resume from where you left off, creating the remaining components using the same positions from the previous plan

Start now.`;

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

      // Don't stop on plan_components - need to create the components
      if (result.plan) {
        return false;
      }

      // Don't stop on manage_todos - this is just for user visibility
      if (result.todos) {
        return false;
      }

      // Success when a component is created/updated
      if (result.status === 'success' && result.component_name) {
        if (this.pendingPlan.length > 0) {
          const allDone = this.pendingPlan.every(p =>
            this.createdComponents.includes(p.name)
          );
          return allDone;
        }
        return true;
      }

      return false;
    });
  }
}

// Export singleton instance
export const componentAgent = new ComponentAgent();
