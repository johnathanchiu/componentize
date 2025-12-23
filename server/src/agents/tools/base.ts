import type { CanvasComponent, AgentTodo } from '../../../../shared/types';

/**
 * Structured tool result - clear success/error with typed side effects
 */
export interface ToolResult {
  success: boolean;
  output?: string;           // Success message/data
  error?: string;            // Error message
  // Structured side effects
  canvasUpdate?: CanvasComponent;
  todosUpdate?: AgentTodo[];
}

/**
 * Context passed to all tool executions
 */
export interface ToolContext {
  projectId: string;
}

/**
 * Tool invocation - holds validated params, executes async
 */
export interface ToolInvocation<TParams = unknown> {
  params: TParams;
  execute(context: ToolContext): Promise<ToolResult>;
}

/**
 * Anthropic tool schema format
 */
export interface ToolSchema {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
}

/**
 * Base tool definition - schema + invocation builder
 */
export interface BaseTool {
  name: string;
  description: string;
  schema: ToolSchema;
  build(params: unknown): ToolInvocation;
}

/**
 * Helper to create Anthropic-format tool schema
 */
export function makeToolSchema(
  name: string,
  description: string,
  properties: Record<string, unknown>,
  required: string[]
): ToolSchema {
  return {
    name,
    description,
    input_schema: {
      type: 'object',
      properties,
      required,
    },
  };
}
