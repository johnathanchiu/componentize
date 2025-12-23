import type { BaseTool, ToolResult, ToolContext, ToolSchema } from './base';

/**
 * Tool Registry - central registration and execution of tools
 */
export class ToolRegistry {
  private tools: Map<string, BaseTool>;

  constructor(tools: BaseTool[]) {
    this.tools = new Map(tools.map(t => [t.name, t]));
  }

  /**
   * Get all tool schemas for LLM
   */
  getSchemas(): ToolSchema[] {
    return Array.from(this.tools.values()).map(t => t.schema);
  }

  /**
   * Get tool names
   */
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Execute a tool by name with given params
   */
  async execute(
    name: string,
    params: unknown,
    context: ToolContext
  ): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        success: false,
        error: `Unknown tool: ${name}`,
      };
    }

    try {
      const invocation = tool.build(params);
      return await invocation.execute(context);
    } catch (error) {
      return {
        success: false,
        error: `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}
