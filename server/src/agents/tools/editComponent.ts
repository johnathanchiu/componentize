import { v4 as uuidv4 } from 'uuid';
import type { BaseTool, ToolResult, ToolContext, ToolInvocation, ToolSchema } from './base';
import { makeToolSchema } from './base';
import { fileService } from '../../services/fileService';
import { projectService, CanvasComponent } from '../../services/projectService';
import { validateComponent } from '../validator';
import { analyzeComplexity } from '../../services/componentAnalyzer';
import { decomposeComponent } from '../../services/componentDecomposer';

// Constants
const DEFAULT_SECTION_HEIGHT = 400;
const START_Y = 0;
const MAX_VALIDATION_FAILURES = 2;

// Track validation failures per component (per session)
const validationFailures = new Map<string, number>();

interface Position {
  x: number;
  y: number;
}

interface Size {
  width: number;
  height: number;
}

interface EditComponentParams {
  name: string;
  code: string;
  position?: Position;
  size?: Size;
}

/**
 * Validate responsive structure - root element must have w-full h-full
 */
function validateResponsiveStructure(name: string, code: string): string | null {
  const returnMatch = code.match(/return\s*\(\s*<(\w+)[^>]*className\s*=\s*["'`]([^"'`]*)["'`]/);

  if (!returnMatch) {
    const anyClassMatch = code.match(/return\s*\(\s*<(\w+)/);
    if (anyClassMatch) {
      return `Component "${name}" root element must have className with "w-full h-full". ` +
        `Add className="w-full h-full ..." to the root <${anyClassMatch[1]}> element for canvas resize support.`;
    }
    return null;
  }

  const [, tagName, className] = returnMatch;
  const hasWidthFull = /\bw-full\b/.test(className);
  const hasHeightFull = /\bh-full\b/.test(className);

  if (!hasWidthFull || !hasHeightFull) {
    const missing = [];
    if (!hasWidthFull) missing.push('w-full');
    if (!hasHeightFull) missing.push('h-full');

    return `Component "${name}" root <${tagName}> must have "${missing.join(' ')}" in className for canvas resize support. ` +
      `Found: className="${className}". Add the missing classes to make the component responsive.`;
  }

  return null;
}

/**
 * Calculate auto-position for a new component
 */
async function calculateAutoPosition(projectId: string, createdCount: number): Promise<Position> {
  const canvas = await projectService.getCanvas(projectId);

  let totalY = START_Y;
  for (const comp of canvas) {
    const height = comp.size?.height || DEFAULT_SECTION_HEIGHT;
    totalY = Math.max(totalY, comp.position.y + height);
  }

  totalY += createdCount * DEFAULT_SECTION_HEIGHT;

  return { x: 0, y: totalY };
}

/**
 * EditComponent invocation
 */
class EditComponentInvocation implements ToolInvocation<EditComponentParams> {
  constructor(public params: EditComponentParams) {}

  async execute(context: ToolContext): Promise<ToolResult> {
    const { name, code, position, size } = this.params;
    const { projectId } = context;

    const currentFailures = validationFailures.get(name) || 0;

    // Check if component file exists (determines update vs create)
    const existingResult = await fileService.readProjectComponent(projectId, name);
    const isUpdate = existingResult.status === 'success';

    // Validate (unless we've hit max failures)
    if (currentFailures < MAX_VALIDATION_FAILURES) {
      const responsiveError = validateResponsiveStructure(name, code);
      if (responsiveError) {
        validationFailures.set(name, currentFailures + 1);
        const remaining = MAX_VALIDATION_FAILURES - currentFailures - 1;
        return {
          success: false,
          error: `${responsiveError}${remaining > 0 ? ` (${remaining} attempt(s) remaining)` : ' (final attempt - will save without validation next time)'}`
        };
      }

      const compileError = validateComponent(code, name);
      if (compileError) {
        validationFailures.set(name, currentFailures + 1);
        const remaining = MAX_VALIDATION_FAILURES - currentFailures - 1;
        return {
          success: false,
          error: `Component "${name}" has errors: ${compileError}. Please fix and try again.${remaining > 0 ? ` (${remaining} attempt(s) remaining)` : ' (final attempt - will save without validation next time)'}`
        };
      }
    }

    // Update existing component (no canvas change needed)
    if (isUpdate) {
      const result = await fileService.updateProjectComponent(projectId, name, code);
      validationFailures.delete(name);
      return {
        success: result.status === 'success',
        output: result.status === 'success' ? `Updated component "${name}"` : undefined,
        error: result.status === 'error' ? result.message : undefined,
      };
    }

    // Check if already on canvas (prevents duplicates on resume/retry)
    const existingCanvas = await projectService.getCanvas(projectId);
    if (existingCanvas.some(c => c.componentName === name)) {
      validationFailures.delete(name);
      return {
        success: true,
        output: `Component "${name}" already exists on canvas - skipped`,
      };
    }

    // Check complexity and auto-decompose if too large
    const complexity = analyzeComplexity(code, name);
    if (complexity.isComplex) {
      const autoPosition = position ?? await calculateAutoPosition(projectId, 0);

      const pieces = decomposeComponent(code, name, autoPosition, size);

      if (pieces.length > 1) {
        const createdPieces: CanvasComponent[] = [];
        const canvas = await projectService.getCanvas(projectId);

        for (const piece of pieces) {
          const pieceResult = await fileService.createProjectComponent(projectId, piece.name, piece.code);
          if (pieceResult.status === 'success') {
            const canvasComp: CanvasComponent = {
              id: uuidv4(),
              componentName: piece.name,
              position: piece.position,
              size: piece.size
            };
            canvas.push(canvasComp);
            createdPieces.push(canvasComp);
          }
        }

        await projectService.saveCanvas(projectId, canvas);
        validationFailures.delete(name);

        const pieceNames = createdPieces.map(p => p.componentName).join(', ');
        return {
          success: true,
          output: `Component "${name}" was too complex (${complexity.reasons.join(', ')}). Auto-split into ${pieces.length} atomic pieces: ${pieceNames}`,
          // Return first piece as canvas update for UI
          canvasUpdate: createdPieces[0],
        };
      }
    }

    // Create new component file
    const result = await fileService.createProjectComponent(projectId, name, code);

    if (result.status !== 'success') {
      return {
        success: false,
        error: result.message,
      };
    }

    // Calculate position and add to canvas
    const finalPosition = position ?? await calculateAutoPosition(projectId, 0);

    const canvasComponent: CanvasComponent = {
      id: uuidv4(),
      componentName: name,
      position: finalPosition,
      size
    };

    existingCanvas.push(canvasComponent);
    await projectService.saveCanvas(projectId, existingCanvas);

    validationFailures.delete(name);

    return {
      success: true,
      output: `Created component "${name}" and placed on canvas at (${finalPosition.x}, ${finalPosition.y})`,
      canvasUpdate: canvasComponent,
    };
  }
}

/**
 * EditComponent Tool - creates or updates a component
 */
export class EditComponentTool implements BaseTool {
  name = 'edit_component';
  description = 'Create a new component or update an existing one. If the component exists, it will be updated. If not, it will be created and placed on the canvas.';

  schema: ToolSchema = makeToolSchema(
    this.name,
    this.description,
    {
      name: {
        type: 'string',
        description: 'Component name in PascalCase (e.g., Button, PricingCard)'
      },
      code: {
        type: 'string',
        description: 'The complete React TypeScript component code including imports, types, and export'
      },
      position: {
        type: 'object',
        description: 'Optional position on canvas (only used when creating new components). If omitted, auto-positions based on existing components.',
        properties: {
          x: { type: 'number' },
          y: { type: 'number' }
        }
      },
      size: {
        type: 'object',
        description: 'Optional size (only used when creating new components). If omitted, defaults to 300x200.',
        properties: {
          width: { type: 'number' },
          height: { type: 'number' }
        }
      }
    },
    ['name', 'code']
  );

  build(params: unknown): ToolInvocation<EditComponentParams> {
    const p = params as EditComponentParams;
    return new EditComponentInvocation({
      name: p.name,
      code: p.code,
      position: p.position,
      size: p.size,
    });
  }
}
