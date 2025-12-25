import { v4 as uuidv4 } from 'uuid';
import type { BaseTool, ToolResult, ToolContext, ToolInvocation, ToolSchema } from './base';
import { makeToolSchema } from './base';
import { fileService } from '../../services/fileService';
import { projectService, CanvasComponent } from '../../services/projectService';
import { validateComponent } from '../validator';

interface EditComponentParams {
  name: string;
  code: string;
  section?: string;
  sectionLayout?: 'row' | 'column';
  size?: { width: number; height: number };
  gap?: number;
}

// Default sizes for common component types
const DEFAULT_SIZES: Record<string, { width: number; height: number }> = {
  // Full-width components
  navbar: { width: 1200, height: 80 },
  nav: { width: 1200, height: 80 },
  footer: { width: 1200, height: 100 },
  // Headlines and text
  headline: { width: 800, height: 100 },
  heading: { width: 800, height: 100 },
  title: { width: 600, height: 80 },
  subtext: { width: 600, height: 60 },
  description: { width: 500, height: 50 },
  // Buttons and CTAs
  button: { width: 200, height: 50 },
  cta: { width: 250, height: 60 },
  btn: { width: 200, height: 50 },
  // Cards
  card: { width: 350, height: 400 },
  pricing: { width: 350, height: 450 },
  feature: { width: 300, height: 350 },
  // Icons
  icon: { width: 80, height: 80 },
  logo: { width: 120, height: 40 },
  // Default fallback
  default: { width: 300, height: 200 },
};

function inferSize(name: string): { width: number; height: number } {
  const lowerName = name.toLowerCase();
  for (const [key, size] of Object.entries(DEFAULT_SIZES)) {
    if (lowerName.includes(key)) {
      return size;
    }
  }
  return DEFAULT_SIZES.default;
}

/**
 * Section-based edit component invocation:
 * 1. Write code to file
 * 2. Validate syntax
 * 3. Add to section (auto-creates if needed)
 * 4. Calculate position based on section layout
 */
class EditComponentInvocation implements ToolInvocation<EditComponentParams> {
  constructor(public params: EditComponentParams) {}

  async execute(context: ToolContext): Promise<ToolResult> {
    const { name, code, section, sectionLayout = 'column', size, gap } = this.params;
    const { projectId } = context;

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

    // Determine component size
    const componentSize = size ?? inferSize(name);

    // Check if component already exists on canvas
    const canvas = await projectService.getCanvas(projectId);
    const existing = canvas.find(c => c.componentName === name);

    if (section) {
      // Section-based layout
      // Step 1: Update layout.json with the new/updated component
      const { layout } = await projectService.addComponentToSection(
        projectId,
        section,
        name,
        componentSize,
        gap,
        sectionLayout
      );

      // Step 2: Add component to canvas if it doesn't exist (with placeholder position)
      if (!existing) {
        const canvasComponent: CanvasComponent = {
          id: uuidv4(),
          componentName: name,
          position: { x: 0, y: 0 }, // Will be recalculated
          size: componentSize,
          section,
        };
        canvas.push(canvasComponent);
        await projectService.saveCanvas(projectId, canvas);
      } else {
        // Update size if changed
        existing.size = componentSize;
        existing.section = section;
        await projectService.saveCanvas(projectId, canvas);
      }

      // Step 3: Recalculate ALL positions in this section (fixes row centering)
      const updatedComponents = await projectService.recalculateSectionPositions(projectId, section);

      // Step 4: Find this component's new position
      const thisComponent = updatedComponents.find(c => c.componentName === name);
      const position = thisComponent?.position ?? { x: 0, y: 0 };

      // Build informative output
      const sectionInfo = layout.sections.find(s => s.name === section);
      const componentCount = sectionInfo?.components.length ?? 0;
      const layoutType = sectionInfo?.layout ?? sectionLayout;

      const output = existing
        ? `Updated "${name}" in section '${section}' (${layoutType}). Position: (${Math.round(position.x)}, ${Math.round(position.y)})`
        : `Created "${name}" in section '${section}' (${layoutType}, ${componentCount} component${componentCount !== 1 ? 's' : ''}). Position: (${Math.round(position.x)}, ${Math.round(position.y)})`;

      return {
        success: true,
        output,
        canvasUpdate: thisComponent ?? { id: '', componentName: name, position, size: componentSize, section },
      };
    }

    // Legacy behavior: no section specified, use simple vertical stacking
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
      size: componentSize,
    };

    canvas.push(canvasComponent);
    await projectService.saveCanvas(projectId, canvas);

    return {
      success: true,
      output: `Created "${name}" at position (0, ${maxY})`,
      canvasUpdate: canvasComponent,
    };
  }
}

/**
 * EditComponent Tool - creates or updates a component with section-based layout
 */
export class EditComponentTool implements BaseTool {
  name = 'edit_component';
  description = `Create or update a component with section-based layout.

Components are organized into sections that stack vertically on the page.
Each section has a layout type:
- 'column': Components stack vertically within the section, each centered
- 'row': Components appear side by side, the entire row centered

The canvas auto-calculates positions based on section membership.`;

  schema: ToolSchema = makeToolSchema(
    this.name,
    this.description,
    {
      name: {
        type: 'string',
        description: 'Component name in PascalCase (e.g., HeroHeadline, PricingCard)'
      },
      code: {
        type: 'string',
        description: 'Complete React TypeScript component code. Root element must have className="w-full h-full" for canvas sizing.'
      },
      section: {
        type: 'string',
        description: 'Section name (e.g., "nav", "hero", "features", "pricing", "footer"). Creates section if it doesn\'t exist.'
      },
      sectionLayout: {
        type: 'string',
        enum: ['row', 'column'],
        description: 'Layout type for the section. "column" stacks vertically (default), "row" places side by side.'
      },
      size: {
        type: 'object',
        properties: {
          width: { type: 'number', description: 'Component width in pixels' },
          height: { type: 'number', description: 'Component height in pixels' }
        },
        description: 'Component size. If not specified, inferred from component name.'
      },
      gap: {
        type: 'number',
        description: 'Gap in pixels from previous component in section (default: 20)'
      },
    },
    ['name', 'code']
  );

  build(params: unknown): ToolInvocation<EditComponentParams> {
    const p = params as EditComponentParams;
    return new EditComponentInvocation({
      name: p.name,
      code: p.code,
      section: p.section,
      sectionLayout: p.sectionLayout,
      size: p.size,
      gap: p.gap,
    });
  }
}
