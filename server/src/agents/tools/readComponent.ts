import type { BaseTool, ToolResult, ToolContext, ToolInvocation, ToolSchema } from './base';
import { makeToolSchema } from './base';
import { fileService } from '../../services/fileService';

interface ReadComponentParams {
  name: string;
}

/**
 * ReadComponent invocation
 */
class ReadComponentInvocation implements ToolInvocation<ReadComponentParams> {
  constructor(public params: ReadComponentParams) {}

  async execute(context: ToolContext): Promise<ToolResult> {
    const { name } = this.params;
    const { projectId } = context;

    const result = await fileService.readProjectComponent(projectId, name);

    if (result.status === 'success') {
      return {
        success: true,
        output: `Component "${name}" code:\n\n${result.content}`,
      };
    }

    return {
      success: false,
      error: result.message,
    };
  }
}

/**
 * ReadComponent Tool - reads component source code
 */
export class ReadComponentTool implements BaseTool {
  name = 'read_component';
  description = 'Read the source code of an existing component to understand its structure before making changes.';

  schema: ToolSchema = makeToolSchema(
    this.name,
    this.description,
    {
      name: {
        type: 'string',
        description: 'The name of the component to read (e.g., Button, PricingCard)'
      }
    },
    ['name']
  );

  build(params: unknown): ToolInvocation<ReadComponentParams> {
    const p = params as ReadComponentParams;
    return new ReadComponentInvocation({ name: p.name });
  }
}
