import { v4 as uuidv4 } from 'uuid';
import type { ToolResult } from '../base';
import { fileService } from '../../services/fileService';
import { projectService, CanvasComponent } from '../../services/projectService';
import { validateComponent } from '../validator';
import type {
  EditComponentInput,
  ManageTodosInput,
  ReadComponentInput,
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
      `Try again with a simpler component under ${MAX_COMPONENT_LINES} lines.`;
  }
  return null;
}

/**
 * Validate responsive structure - root element must have w-full h-full
 */
export function validateResponsiveStructure(name: string, code: string): string | null {
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
  createdComponents: string[];
  validationFailures: Map<string, number>;
}

/**
 * Calculate auto-position for a new component based on existing components
 */
async function calculateAutoPosition(projectId: string, createdCount: number): Promise<Position> {
  const canvas = await projectService.getCanvas(projectId);
  const totalIndex = canvas.length + createdCount;

  return {
    x: START_X + (totalIndex % GRID_COLUMNS) * SPACING_X,
    y: START_Y + Math.floor(totalIndex / GRID_COLUMNS) * SPACING_Y
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
 * Handle edit_component tool - creates or updates a component
 */
export async function handleEditComponent(
  input: EditComponentInput,
  context: HandlerContext
): Promise<ToolResult> {
  const { name, code } = input;
  const { projectId, validationFailures, createdComponents } = context;

  const currentFailures = validationFailures.get(name) || 0;

  // Check if component exists
  const existingResult = await fileService.readProjectComponent(projectId, name);
  const isUpdate = existingResult.status === 'success';

  // Validate (unless we've hit max failures)
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

  // Update existing component
  if (isUpdate) {
    const result = await fileService.updateProjectComponent(projectId, name, code);
    validationFailures.delete(name);
    return {
      status: result.status,
      message: result.status === 'success'
        ? `Updated component "${name}"`
        : result.message,
      component_name: name,
      action: 'update'
    };
  }

  // Create new component
  const result = await fileService.createProjectComponent(projectId, name, code);

  if (result.status !== 'success') {
    return { status: 'error', message: result.message };
  }

  // Calculate position for new component
  const position = input.position ?? await calculateAutoPosition(projectId, createdComponents.length);
  const size = input.size;

  const canvasComponent: CanvasComponent = {
    id: uuidv4(),
    componentName: name,
    position,
    size
  };

  const existingCanvas = await projectService.getCanvas(projectId);
  existingCanvas.push(canvasComponent);
  await projectService.saveCanvas(projectId, existingCanvas);

  createdComponents.push(name);
  validationFailures.delete(name);

  return {
    status: 'success',
    message: `Created component "${name}" and placed on canvas at (${position.x}, ${position.y})`,
    component_name: name,
    action: 'create',
    canvasComponent
  };
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
