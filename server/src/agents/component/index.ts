import { BaseAgent, type ToolResult } from '../base';
import type { StreamEvent, ComponentPlan } from '../../../../shared/types';
import { COMPONENT_TOOLS } from './tools';
import { SYSTEM_PROMPT } from './prompt';
import {
  buildCanvasContext,
  handlePlanComponents,
  handleCreateComponent,
  handleReadComponent,
  handleUpdateComponent,
  handleCreateLayout,
  handleManageTodos,
  type HandlerContext,
} from './handlers';
import type {
  PlanComponentsInput,
  CreateComponentInput,
  CreateLayoutInput,
  ManageTodosInput,
  ReadComponentInput,
  UpdateComponentInput,
} from './types';

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

      case 'create_layout': {
        return handleCreateLayout(toolInput as CreateLayoutInput, this.projectId);
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

    yield { type: 'progress', message: 'Processing request...', timestamp: Date.now() };

    const canvasContext = await buildCanvasContext(this.projectId);

    const messages = [
      {
        role: 'user' as const,
        content: `${canvasContext}

USER REQUEST: ${prompt}

Based on the complexity of this request:
- If simple (single button, card, form): Call create_component directly
- If complex (landing page, multiple elements): Call plan_components first, then create each

Start now.`
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
