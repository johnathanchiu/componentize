import type { BaseTool, ToolResult, ToolContext, ToolInvocation, ToolSchema } from './base';
import { makeToolSchema } from './base';
import { projectService } from '../../services/projectService';

/**
 * GetLayout invocation - returns sections, layers, and page style
 */
class GetLayoutInvocation implements ToolInvocation<Record<string, never>> {
  constructor(public params: Record<string, never>) {}

  async execute(context: ToolContext): Promise<ToolResult> {
    const { projectId } = context;

    const canvas = await projectService.getCanvas(projectId);
    const layout = await projectService.getLayout(projectId);

    // Build output
    const lines: string[] = [];

    // Page style
    lines.push(`Page: ${layout.pageStyle.width}px wide`);
    if (layout.pageStyle.background) {
      lines.push(`Background: ${layout.pageStyle.background}`);
    }
    lines.push('');

    // Sections
    if (layout.sections.length === 0) {
      lines.push('No sections defined. Use edit_component with section param to create sections.');
    } else {
      lines.push(`Sections (${layout.sections.length}):`);
      for (const section of layout.sections) {
        const componentList = section.components.map(c => c.name).join(', ') || '(empty)';
        lines.push(`  ${section.name} [${section.layout}]: ${componentList}`);
      }
    }
    lines.push('');

    // Layers
    if (layout.layers.length > 0) {
      lines.push(`Layers (${layout.layers.length}):`);
      for (const layer of layout.layers) {
        const trigger = layer.trigger ? ` (triggered by ${layer.trigger.componentName} ${layer.trigger.event})` : '';
        lines.push(`  ${layer.name} [${layer.type}]: ${layer.components.join(', ')}${trigger}`);
      }
      lines.push('');
    }

    // Canvas components (with calculated positions)
    if (canvas.length > 0) {
      lines.push(`Canvas components (${canvas.length}):`);
      for (const c of canvas) {
        const size = c.size ? ` ${c.size.width}x${c.size.height}` : '';
        const section = c.section ? ` [${c.section}]` : '';
        lines.push(`  ${c.componentName}${section} at (${Math.round(c.position.x)}, ${Math.round(c.position.y)})${size}`);
      }
    }

    return {
      success: true,
      output: lines.join('\n'),
    };
  }
}

/**
 * GetLayout Tool - returns the current canvas layout with sections and layers
 */
export class GetLayoutTool implements BaseTool {
  name = 'get_layout';
  description = `Get the current page layout including sections, layers, and component positions.

Returns:
- Page style (width, background)
- Sections with their layout type (row/column) and components
- Layers (modals, drawers) and their triggers
- All canvas components with calculated positions

Call this before adding components to understand the current state.`;

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
