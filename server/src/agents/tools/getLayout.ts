import type { BaseTool, ToolResult, ToolContext, ToolInvocation, ToolSchema } from './base';
import { makeToolSchema } from './base';
import { projectService } from '../../services/projectService';

/**
 * GetLayout invocation
 */
class GetLayoutInvocation implements ToolInvocation<Record<string, never>> {
  constructor(public params: Record<string, never>) {}

  async execute(context: ToolContext): Promise<ToolResult> {
    const { projectId } = context;

    const canvas = await projectService.getCanvas(projectId);
    const project = await projectService.getProject(projectId);

    const layout = {
      pageStyle: project?.pageStyle || { width: 800 },
      components: canvas.map(c => ({
        name: c.componentName,
        position: c.position,
        size: c.size,
      }))
    };

    const output = canvas.length === 0
      ? 'Canvas is empty. Use edit_component to add components.'
      : `Canvas has ${canvas.length} component(s):\n${canvas.map(c => {
          const size = c.size ? ` (${c.size.width}x${c.size.height})` : '';
          return `- ${c.componentName} at (${c.position.x}, ${c.position.y})${size}`;
        }).join('\n')}`;

    return {
      success: true,
      output,
    };
  }
}

/**
 * GetLayout Tool - returns the current canvas layout
 */
export class GetLayoutTool implements BaseTool {
  name = 'get_layout';
  description = 'Get the current canvas layout. Returns all components with their positions and sizes. Call this before adding components to understand what already exists on the canvas.';

  schema: ToolSchema = makeToolSchema(
    this.name,
    this.description,
    {},
    []
  );

  build(params: unknown): ToolInvocation<Record<string, never>> {
    return new GetLayoutInvocation({});
  }
}
