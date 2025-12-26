import type { BaseTool, ToolResult, ToolContext, ToolInvocation, ToolSchema } from './base';
import { makeToolSchema } from './base';
import { projectService } from '../../services/projectService';

interface SetPageStyleParams {
  width?: number;
  background?: string;
}

/**
 * SetPageStyle invocation
 */
class SetPageStyleInvocation implements ToolInvocation<SetPageStyleParams> {
  constructor(public params: SetPageStyleParams) {}

  async execute(context: ToolContext): Promise<ToolResult> {
    const { projectId } = context;
    const { width, background } = this.params;

    const updates: { width?: number; background?: string } = {};
    if (width !== undefined) updates.width = width;
    if (background !== undefined) updates.background = background;

    const layout = await projectService.updatePageStyle(projectId, updates);

    const parts: string[] = [];
    if (width !== undefined) parts.push(`width: ${width}px`);
    if (background !== undefined) parts.push(`background: ${background}`);

    return {
      success: true,
      output: `Page style updated: ${parts.join(', ')}`,
    };
  }
}

/**
 * SetPageStyle Tool - configure page-level styling
 */
export class SetPageStyleTool implements BaseTool {
  name = 'set_page_style';
  description = `Set the page-level styling options.

Use this to configure:
- Page width (affects component centering)
- Background color or gradient

Examples:
- set_page_style({ width: 1200, background: "#0f172a" })
- set_page_style({ background: "linear-gradient(180deg, #0f172a 0%, #1e293b 100%)" })`;

  schema: ToolSchema = makeToolSchema(
    this.name,
    this.description,
    {
      width: {
        type: 'number',
        description: 'Page width in pixels (default: 1200). Components are centered within this width.'
      },
      background: {
        type: 'string',
        description: 'Background color or CSS gradient. Examples: "#0f172a", "linear-gradient(180deg, #0f172a 0%, #1e293b 100%)"'
      },
    },
    []
  );

  build(params: unknown): ToolInvocation<SetPageStyleParams> {
    const p = params as SetPageStyleParams;
    return new SetPageStyleInvocation({ width: p.width, background: p.background });
  }
}
