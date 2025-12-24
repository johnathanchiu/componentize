import { v4 as uuidv4 } from 'uuid';
import type { BaseTool, ToolResult, ToolContext, ToolInvocation, ToolSchema } from './base';
import { makeToolSchema } from './base';
import { fileService } from '../../services/fileService';
import { projectService, CanvasComponent } from '../../services/projectService';
import { validateComponent } from '../validator';

interface EditComponentParams {
  name: string;
  code: string;
}

/**
 * Simple edit component invocation:
 * 1. Write code to file
 * 2. Validate syntax
 * 3. Add to canvas if new, or update if exists
 */
class EditComponentInvocation implements ToolInvocation<EditComponentParams> {
  constructor(public params: EditComponentParams) {}

  async execute(context: ToolContext): Promise<ToolResult> {
    const { name, code } = this.params;
    const { projectId } = context;

    // Check if component already exists on canvas
    const canvas = await projectService.getCanvas(projectId);
    const existing = canvas.find(c => c.componentName === name);

    // Validate syntax before writing
    const validationError = validateComponent(code, name);
    if (validationError) {
      return {
        success: false,
        error: validationError,
      };
    }

    // Write component to file
    const result = await fileService.createProjectComponent(projectId, name, code);
    if (result.status !== 'success') {
      return {
        success: false,
        error: result.message,
      };
    }

    if (existing) {
      return {
        success: true,
        output: `Updated "${name}"`,
        canvasUpdate: existing,
      };
    }

    // New component - add to canvas below existing components
    let maxY = 0;
    for (const comp of canvas) {
      const bottom = comp.position.y + (comp.size?.height ?? 200);
      maxY = Math.max(maxY, bottom);
    }

    const canvasComponent: CanvasComponent = {
      id: uuidv4(),
      componentName: name,
      position: { x: 0, y: maxY },
    };

    canvas.push(canvasComponent);
    await projectService.saveCanvas(projectId, canvas);

    return {
      success: true,
      output: `Created "${name}"`,
      canvasUpdate: canvasComponent,
    };
  }
}

/**
 * EditComponent Tool - creates or updates a component
 */
export class EditComponentTool implements BaseTool {
  name = 'edit_component';
  description = 'Create a new component or update an existing one. Component will be validated for syntax errors.';

  schema: ToolSchema = makeToolSchema(
    this.name,
    this.description,
    {
      name: {
        type: 'string',
        description: 'Component name in PascalCase (e.g., HeroSection, PricingCard)'
      },
      code: {
        type: 'string',
        description: 'Complete React TypeScript component code. Root element must have className="w-full h-full" for canvas sizing.'
      },
    },
    ['name', 'code']
  );

  build(params: unknown): ToolInvocation<EditComponentParams> {
    const p = params as EditComponentParams;
    return new EditComponentInvocation({ name: p.name, code: p.code });
  }
}
