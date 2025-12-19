import { v4 as uuidv4 } from 'uuid';
import type { ToolResult } from '../base';
import { fileService } from '../../services/fileService';
import { projectService, CanvasComponent } from '../../services/projectService';
import { validateComponent } from '../validator';
import { analyzeComplexity } from '../../services/componentAnalyzer';
import { decomposeComponent } from '../../services/componentDecomposer';
import type {
  PlanComponentsInput,
  CreateComponentInput,
  ManageTodosInput,
  ReadComponentInput,
  UpdateComponentInput,
  Position,
  Size,
} from './types';

// Constants
export const DEFAULT_POSITION: Position = { x: 400, y: 300 };
export const DEFAULT_SIZE: Size = { width: 300, height: 200 };
export const MAX_COMPONENT_LINES = 50;
export const MAX_VALIDATION_FAILURES = 2;

// Grid layout constants for auto-positioning
const GRID_COLUMNS = 3;
const SPACING_X = 400;
const SPACING_Y = 500;
const START_X = 100;
const START_Y = 100;

/**
 * Validate component size - returns error message if too large, null if OK
 */
export function validateComponentSize(name: string, code: string): string | null {
  const lineCount = code.split('\n').length;
  if (lineCount > MAX_COMPONENT_LINES) {
    return `Component "${name}" is ${lineCount} lines, which exceeds the ${MAX_COMPONENT_LINES}-line limit. ` +
      `Components must be ATOMIC and single-purpose. This component is too complex - break it into smaller pieces. ` +
      `For example, if this is a "HeroSection", create just "HeroHeadline" (text only) or "HeroCTA" (button only). ` +
      `Try again with a simpler component under ${MAX_COMPONENT_LINES} lines.`;
  }
  return null;
}

/**
 * Validate responsive structure - root element must have w-full h-full
 * This ensures components can be properly resized on the canvas
 */
export function validateResponsiveStructure(name: string, code: string): string | null {
  // Find the return statement's JSX - look for return followed by ( and <
  // This handles both `return (<div` and `return (\n    <div` patterns
  const returnMatch = code.match(/return\s*\(\s*<(\w+)[^>]*className\s*=\s*["'`]([^"'`]*)["'`]/);

  if (!returnMatch) {
    // Component might use a different pattern (e.g., returning a shadcn component)
    // Check if there's a root element with className at all
    const anyClassMatch = code.match(/return\s*\(\s*<(\w+)/);
    if (anyClassMatch) {
      // There's a return with JSX but no className on root - that's an error
      return `Component "${name}" root element must have className with "w-full h-full". ` +
        `Add className="w-full h-full ..." to the root <${anyClassMatch[1]}> element for canvas resize support.`;
    }
    // No clear pattern found, skip validation
    return null;
  }

  const [, tagName, className] = returnMatch;

  // Check for w-full and h-full (can be in any order, with other classes)
  const hasWidthFull = /\bw-full\b/.test(className);
  const hasHeightFull = /\bh-full\b/.test(className);

  if (!hasWidthFull || !hasHeightFull) {
    const missing = [];
    if (!hasWidthFull) missing.push('w-full');
    if (!hasHeightFull) missing.push('h-full');

    return `Component "${name}" root <${tagName}> must have "${missing.join(' ')}" in className for canvas resize support. ` +
      `Found: className="${className}". ` +
      `Add the missing classes to make the component responsive.`;
  }

  return null;
}

/**
 * Build canvas context string to inject into the user prompt
 */
export async function buildCanvasContext(projectId: string | null): Promise<string> {
  if (!projectId) {
    return 'CURRENT CANVAS: Empty (no project set)';
  }

  const canvas = await projectService.getCanvas(projectId);
  const allComponents = await projectService.listComponents(projectId);

  if (canvas.length === 0 && allComponents.length === 0) {
    return 'CURRENT CANVAS: Empty (no components yet)';
  }

  const onCanvas = canvas.map(c => {
    const pos = `(${c.position.x}, ${c.position.y})`;
    const size = c.size ? `, ${c.size.width}x${c.size.height}` : '';
    return `  - ${c.componentName} at ${pos}${size}`;
  }).join('\n');

  const canvasNames = new Set(canvas.map(c => c.componentName));
  const available = allComponents.filter(c => !canvasNames.has(c));

  let context = 'CURRENT CANVAS:';

  if (canvas.length > 0) {
    context += `\nComponents on canvas:\n${onCanvas}`;
  } else {
    context += '\nComponents on canvas: (none)';
  }

  if (available.length > 0) {
    context += `\n\nAvailable components (not placed): ${available.join(', ')}`;
  }

  return context;
}

/**
 * Context passed to tool handlers
 */
export interface HandlerContext {
  projectId: string;
  pendingPlan: ComponentPlan[];
  createdComponents: string[];
  validationFailures: Map<string, number>;
}

export interface ComponentPlan {
  name: string;
  description: string;
  position: Position;
  size?: Size;
}

/**
 * Handle plan_components tool
 */
export function handlePlanComponents(
  input: PlanComponentsInput,
  context: HandlerContext
): { result: ToolResult; updatedPlan: ComponentPlan[] } {
  const { components } = input;

  const plan = components.map((c, index) => ({
    name: c.name,
    description: c.description,
    position: c.position || {
      x: START_X + (index % GRID_COLUMNS) * SPACING_X,
      y: START_Y + Math.floor(index / GRID_COLUMNS) * SPACING_Y
    },
    size: c.size
  }));

  return {
    result: {
      status: 'success',
      message: `Planned ${components.length} components: ${components.map(c => c.name).join(', ')}. Now create each one.`,
      plan,
      totalComponents: components.length
    },
    updatedPlan: plan
  };
}

/**
 * Handle create_component tool
 */
export async function handleCreateComponent(
  input: CreateComponentInput,
  context: HandlerContext
): Promise<ToolResult> {
  const { name, code } = input;
  const { projectId, pendingPlan, validationFailures } = context;

  const plannedComponent = pendingPlan.find(p => p.name === name);
  const position = input.position ?? plannedComponent?.position ?? DEFAULT_POSITION;
  const size = input.size ?? plannedComponent?.size;

  const currentFailures = validationFailures.get(name) || 0;

  if (currentFailures < MAX_VALIDATION_FAILURES) {
    const sizeError = validateComponentSize(name, code);
    if (sizeError) {
      validationFailures.set(name, currentFailures + 1);
      const remaining = MAX_VALIDATION_FAILURES - currentFailures - 1;
      return {
        status: 'error',
        message: `${sizeError}${remaining > 0 ? ` (${remaining} attempt(s) remaining)` : ' (final attempt - will save without validation next time)'}`
      };
    }

    // Validate responsive structure (w-full h-full on root)
    const responsiveError = validateResponsiveStructure(name, code);
    if (responsiveError) {
      validationFailures.set(name, currentFailures + 1);
      const remaining = MAX_VALIDATION_FAILURES - currentFailures - 1;
      return {
        status: 'error',
        message: `${responsiveError}${remaining > 0 ? ` (${remaining} attempt(s) remaining)` : ' (final attempt - will save without validation next time)'}`
      };
    }

    const compileError = validateComponent(code, name);
    if (compileError) {
      validationFailures.set(name, currentFailures + 1);
      const remaining = MAX_VALIDATION_FAILURES - currentFailures - 1;
      return {
        status: 'error',
        message: `Component "${name}" has errors: ${compileError}. Please fix and try again.${remaining > 0 ? ` (${remaining} attempt(s) remaining)` : ' (final attempt - will save without validation next time)'}`
      };
    }

    // Check complexity and try automatic decomposition
    const complexity = analyzeComplexity(code, name);
    if (complexity.isComplex) {
      console.log(`Component "${name}" is complex: ${complexity.reasons.join(', ')}`);

      // Try automatic decomposition
      try {
        const decomposed = decomposeComponent(code, name, position);

        if (decomposed.length > 1) {
          console.log(`Decomposing "${name}" into ${decomposed.length} atomic components`);

          const existingCanvas = await projectService.getCanvas(projectId);
          const createdNames: string[] = [];

          // Save each decomposed component
          for (const comp of decomposed) {
            const saveResult = await fileService.createProjectComponent(projectId, comp.name, comp.code);
            if (saveResult.status !== 'success') {
              console.error(`Failed to save decomposed component ${comp.name}:`, saveResult.message);
              continue;
            }

            const canvasComp: CanvasComponent = {
              id: uuidv4(),
              componentName: comp.name,
              position: comp.position,
              size: comp.size
            };
            existingCanvas.push(canvasComp);
            createdNames.push(comp.name);
            context.createdComponents.push(comp.name);
          }

          await projectService.saveCanvas(projectId, existingCanvas);
          validationFailures.delete(name);

          return {
            status: 'success',
            message: `Component "${name}" was too complex and has been automatically decomposed into ${createdNames.length} atomic components: ${createdNames.join(', ')}`,
            decomposed: createdNames,
            originalName: name
          };
        }
      } catch (err) {
        console.error(`Decomposition failed for "${name}":`, err);
        // Fall through to save as-is if decomposition fails
      }

      // If decomposition didn't produce results, return error for agent retry
      validationFailures.set(name, currentFailures + 1);
      const remaining = MAX_VALIDATION_FAILURES - currentFailures - 1;
      return {
        status: 'error',
        message: `Component "${name}" is too complex (${complexity.reasons.join(', ')}). ` +
          `Components must be ATOMIC - one visual element each. ` +
          `Please split into smaller components.${remaining > 0 ? ` (${remaining} attempt(s) remaining)` : ''}`
      };
    }
  } else {
    console.log(`Skipping validation for ${name} after ${currentFailures} failures - saving as-is`);
  }

  const result = await fileService.createProjectComponent(projectId, name, code);

  if (result.status !== 'success') {
    return { status: 'error', message: result.message };
  }

  const canvasComponent: CanvasComponent = {
    id: uuidv4(),
    componentName: name,
    position,
    size
  };

  const existingCanvas = await projectService.getCanvas(projectId);
  existingCanvas.push(canvasComponent);
  await projectService.saveCanvas(projectId, existingCanvas);

  context.createdComponents.push(name);
  validationFailures.delete(name);

  return {
    status: 'success',
    message: `Created component "${name}" and placed on canvas at (${position.x}, ${position.y})`,
    component_name: name,
    canvasComponent
  };
}

/**
 * Handle read_component tool
 */
export async function handleReadComponent(
  input: ReadComponentInput,
  projectId: string
): Promise<ToolResult> {
  const { name } = input;
  const result = await fileService.readProjectComponent(projectId, name);

  if (result.status === 'success') {
    return {
      status: 'success',
      message: `Component '${name}' code:`,
      code: result.content,
      component_name: name,
      action: 'read'
    };
  }
  return {
    status: result.status,
    message: result.message
  };
}

/**
 * Handle update_component tool
 */
export async function handleUpdateComponent(
  input: UpdateComponentInput,
  context: HandlerContext
): Promise<ToolResult> {
  const { name, code } = input;
  const { projectId, validationFailures } = context;

  const currentFailures = validationFailures.get(name) || 0;

  if (currentFailures < MAX_VALIDATION_FAILURES) {
    const sizeError = validateComponentSize(name, code);
    if (sizeError) {
      validationFailures.set(name, currentFailures + 1);
      const remaining = MAX_VALIDATION_FAILURES - currentFailures - 1;
      return {
        status: 'error',
        message: `${sizeError}${remaining > 0 ? ` (${remaining} attempt(s) remaining)` : ' (final attempt - will save without validation next time)'}`
      };
    }

    // Validate responsive structure (w-full h-full on root)
    const responsiveError = validateResponsiveStructure(name, code);
    if (responsiveError) {
      validationFailures.set(name, currentFailures + 1);
      const remaining = MAX_VALIDATION_FAILURES - currentFailures - 1;
      return {
        status: 'error',
        message: `${responsiveError}${remaining > 0 ? ` (${remaining} attempt(s) remaining)` : ' (final attempt - will save without validation next time)'}`
      };
    }

    const compileError = validateComponent(code, name);
    if (compileError) {
      validationFailures.set(name, currentFailures + 1);
      const remaining = MAX_VALIDATION_FAILURES - currentFailures - 1;
      return {
        status: 'error',
        message: `Component "${name}" has errors: ${compileError}. Please fix and try again.${remaining > 0 ? ` (${remaining} attempt(s) remaining)` : ' (final attempt - will save without validation next time)'}`
      };
    }
  } else {
    console.log(`Skipping validation for ${name} after ${currentFailures} failures - saving as-is`);
  }

  const result = await fileService.updateProjectComponent(projectId, name, code);
  validationFailures.delete(name);
  return { ...result, component_name: result.component_name };
}

/**
 * Handle manage_todos tool
 */
export function handleManageTodos(input: ManageTodosInput): ToolResult {
  const { todos } = input;
  return {
    status: 'success',
    message: `Updated ${todos.length} tasks`,
    todos
  };
}
